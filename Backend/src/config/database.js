const sql = require('mssql');
require('dotenv').config();

// Get the connection string from environment variables
const connectionString = process.env.DB_CONNECTION_STRING;

console.log('Attempting to connect to database...');

let pool = null;

async function getPool() {
    try {
        if (pool) {
            try {
                await pool.request().query('SELECT 1');
                return pool;
            } catch (error) {
                console.log('Connection lost, creating new pool...');
                pool = null;
            }
        }

        console.log('Creating new connection pool...');
        pool = await new sql.ConnectionPool(connectionString).connect();
        console.log('Database pool created successfully');
        
        // Handle pool errors
        pool.on('error', err => {
            console.error('Pool error:', err);
            pool = null;
        });

        return pool;
    } catch (err) {
        console.error('Error creating connection pool:', err);
        throw err;
    }
}

async function createUsersTable(pool) {
    try {
        // Check if table exists first
        const tableExists = await checkTableExists(pool, 'Users');
        
        if (!tableExists) {
            // Table doesn't exist, create it with all fields
            await pool.request().query(`
                CREATE TABLE Users (
                    UserId INT IDENTITY(1,1) PRIMARY KEY,
                    FullName NVARCHAR(100) NOT NULL,
                    Email NVARCHAR(100) NOT NULL UNIQUE,
                    PasswordHash NVARCHAR(255) NOT NULL,
                    Role NVARCHAR(20) NOT NULL DEFAULT 'user',
                    IsVerified BIT NOT NULL DEFAULT 0,
                    VerificationToken NVARCHAR(255) NULL,
                    PasswordResetToken NVARCHAR(255) NULL,
                    PasswordResetExpires DATETIME NULL,
                    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
                    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
                    Photo NVARCHAR(500) NULL,
                    GcashQr NVARCHAR(500) NULL,
                    StudentId NVARCHAR(50) NULL,
                    Grade NVARCHAR(20) NULL,
                    Section NVARCHAR(20) NULL,
                    Bio NVARCHAR(500) NULL,
                    IsFreelancer BIT NOT NULL DEFAULT 1,
                    IsClient BIT NOT NULL DEFAULT 1
                )
            `);
            console.log("Users table created");
            
            // Create timestamp trigger
            await pool.request().query(`
                CREATE TRIGGER TR_Users_UpdatedAt
                ON Users
                AFTER UPDATE
                AS
                BEGIN
                    SET NOCOUNT ON;
                    
                    IF NOT UPDATE(UpdatedAt)
                    BEGIN
                        UPDATE Users
                        SET UpdatedAt = GETDATE()
                        FROM Users u
                        INNER JOIN inserted i ON u.UserId = i.UserId;
                    END
                END;
            `);
        } else {
            // Check if Bio column exists
            const bioColumnExists = await checkColumnExists(pool, 'Users', 'Bio');
            
            if (!bioColumnExists) {
                // Add Bio column
                await pool.request().query(`
                    ALTER TABLE Users
                    ADD Bio NVARCHAR(500) NULL;
                `);
                console.log("Bio column added to Users table");
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error in createUsersTable:', error);
        throw error;
    }
}

// Helper function to check if a table exists
async function checkTableExists(pool, tableName) {
    const result = await pool.request().query(`
        SELECT OBJECT_ID('dbo.${tableName}') as TableId
    `);
    return !!result.recordset[0].TableId;
}

// Helper function to check if a column exists in a table
async function checkColumnExists(pool, tableName, columnName) {
    const result = await pool.request().query(`
        SELECT COUNT(1) as ColumnExists
        FROM sys.columns 
        WHERE Name = '${columnName}'
        AND Object_ID = OBJECT_ID('dbo.${tableName}')
    `);
    return !!result.recordset[0].ColumnExists;
}

async function createServicesTable(pool) {
    try {
        // Check if Services table exists
        const tableExists = await checkTableExists(pool, 'Services');
        
        if (!tableExists) {
            // Create Services table with all the necessary columns including Image
            await pool.request().query(`
                CREATE TABLE Services (
                    ServiceId INT IDENTITY(1,1) PRIMARY KEY,
                    Title NVARCHAR(100) NOT NULL,
                    Description NVARCHAR(500) NOT NULL,
                    Price DECIMAL(10, 2) NOT NULL,
                    Category NVARCHAR(50),
                    Status NVARCHAR(50) DEFAULT 'Active',
                    SellerId INT NOT NULL,
                    Image NVARCHAR(MAX) NULL,
                    Photo NVARCHAR(MAX) NULL,
                    PostType NVARCHAR(20) NOT NULL DEFAULT 'freelancer' CHECK (PostType IN ('client', 'freelancer')),
                    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
                    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
                    CONSTRAINT FK_Services_Users FOREIGN KEY (SellerId) REFERENCES Users(UserId)
                )
            `);
            
            console.log("Services table created with both Image and Photo columns");
            
            // Create timestamp trigger
            await pool.request().query(`
                CREATE TRIGGER TR_Services_UpdatedAt
                ON Services
                AFTER UPDATE
                AS
                BEGIN
                    SET NOCOUNT ON;
                    
                    IF NOT UPDATE(UpdatedAt)
                    BEGIN
                        UPDATE Services
                        SET UpdatedAt = GETDATE()
                        FROM Services s
                        INNER JOIN inserted i ON s.ServiceId = i.ServiceId;
                    END
                END;
            `);
            
            // Create trigger to keep Image and Photo synchronized
            await pool.request().query(`
                CREATE TRIGGER TR_Services_SyncImagePhoto
                ON Services
                AFTER INSERT, UPDATE
                AS
                BEGIN
                    SET NOCOUNT ON;
                    
                    -- If Image is updated but Photo isn't, copy Image to Photo
                    UPDATE Services
                    SET Photo = i.Image
                    FROM Services s
                    INNER JOIN inserted i ON s.ServiceId = i.ServiceId
                    WHERE (i.Image IS NOT NULL AND i.Image <> s.Photo) OR (i.Image IS NOT NULL AND s.Photo IS NULL);
                    
                    -- If Photo is updated but Image isn't, copy Photo to Image
                    UPDATE Services
                    SET Image = i.Photo
                    FROM Services s
                    INNER JOIN inserted i ON s.ServiceId = i.ServiceId
                    WHERE (i.Photo IS NOT NULL AND i.Photo <> s.Image) OR (i.Photo IS NOT NULL AND s.Image IS NULL);
                END;
            `);
        } else {
            // Check if Image column exists, add it if it doesn't
            const imageColumnExists = await checkColumnExists(pool, 'Services', 'Image');
            
            if (!imageColumnExists) {
                await pool.request().query(`
                    ALTER TABLE Services
                    ADD Image NVARCHAR(MAX) NULL;
                `);
                console.log("Image column added to Services table");
                
                // If we had to add Image, copy data from Photo if it exists
                await pool.request().query(`
                    UPDATE Services
                    SET Image = Photo
                    WHERE Photo IS NOT NULL;
                `);
                console.log("Copied data from Photo to Image column");
            }
            
            // Check if Photo column exists, add it if it doesn't 
            const photoColumnExists = await checkColumnExists(pool, 'Services', 'Photo');
            
            if (!photoColumnExists) {
                await pool.request().query(`
                    ALTER TABLE Services
                    ADD Photo NVARCHAR(MAX) NULL;
                `);
                console.log("Photo column added to Services table");
                
                // If we had to add Photo, copy data from Image if it exists
                await pool.request().query(`
                    UPDATE Services
                    SET Photo = Image
                    WHERE Image IS NOT NULL;
                `);
                console.log("Copied data from Image to Photo column");
            }
            
            // Check if the sync trigger exists, create it if it doesn't
            const triggerExists = await pool.request().query(`
                SELECT OBJECT_ID('TR_Services_SyncImagePhoto', 'TR') as TriggerId
            `);
            
            if (!triggerExists.recordset[0].TriggerId) {
                await pool.request().query(`
                    CREATE TRIGGER TR_Services_SyncImagePhoto
                    ON Services
                    AFTER INSERT, UPDATE
                    AS
                    BEGIN
                        SET NOCOUNT ON;
                        
                        -- If Image is updated but Photo isn't, copy Image to Photo
                        UPDATE Services
                        SET Photo = i.Image
                        FROM Services s
                        INNER JOIN inserted i ON s.ServiceId = i.ServiceId
                        WHERE (i.Image IS NOT NULL AND i.Image <> s.Photo) OR (i.Image IS NOT NULL AND s.Photo IS NULL);
                        
                        -- If Photo is updated but Image isn't, copy Photo to Image
                        UPDATE Services
                        SET Image = i.Photo
                        FROM Services s
                        INNER JOIN inserted i ON s.ServiceId = i.ServiceId
                        WHERE (i.Photo IS NOT NULL AND i.Photo <> s.Image) OR (i.Photo IS NOT NULL AND s.Image IS NULL);
                    END;
                `);
                console.log("Created trigger to keep Image and Photo columns synchronized");
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error creating Services table:', error);
        throw error;
    }
}

async function createApplicationsTable(pool) {
    try {
        // Create Applications table if it doesn't exist
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'Applications') AND type in (N'U'))
            BEGIN
                CREATE TABLE Applications (
                    ApplicationId INT IDENTITY(1,1) PRIMARY KEY,
                    ServiceId INT NOT NULL,
                    UserId INT NOT NULL,
                    Status NVARCHAR(20) DEFAULT 'Pending',
                    Message NVARCHAR(MAX),
                    CreatedAt DATETIME DEFAULT GETDATE(),
                    UpdatedAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId),
                    FOREIGN KEY (UserId) REFERENCES Users(UserId)
                )
            END
        `);
        console.log('Applications table checked/created');

        // Check and add ProofImage column if it doesn't exist
        await pool.request().query(`
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID(N'Applications') 
                AND name = 'ProofImage'
            )
            BEGIN
                ALTER TABLE Applications
                ADD ProofImage NVARCHAR(MAX) NULL
                PRINT 'ProofImage column added to Applications table'
            END
        `);
        console.log('ProofImage column checked/added');

        return true;
    } catch (error) {
        console.error('Error creating Applications table:', error);
        throw error;
    }
}

async function createTransactionsTable(pool) {
    try {
        // Check if the table exists before creating it
        const tableCheck = await pool.request().query(`
            SELECT OBJECT_ID('dbo.Transactions') as TableId
        `);
        const tableExists = !!tableCheck.recordset[0].TableId;
        
        // If table already exists, ensure triggers exist but don't recreate the table
        if (tableExists) {
            console.log('Transactions table already exists, ensuring triggers are in place');
            
            // Check if triggers exist, create only if they don't exist
            const triggerCheck1 = await pool.request().query(`
                SELECT OBJECT_ID('TR_Transactions_UpdatedAt', 'TR') as TriggerId
            `);
            if (!triggerCheck1.recordset[0].TriggerId) {
                await pool.request().query(`
                    CREATE TRIGGER TR_Transactions_UpdatedAt
                    ON dbo.Transactions
                    AFTER UPDATE
                    AS
                    BEGIN
                        SET NOCOUNT ON;
                        
                        -- Only update timestamp - don't change status if already set to Completed
                        UPDATE dbo.Transactions
                        SET UpdatedAt = GETDATE(),
                            -- Ensure status remains Completed if it was already set to that
                            Status = CASE 
                                WHEN i.Status = 'Completed' THEN 'Completed'
                                WHEN d.Status = 'Completed' AND i.Status <> 'Completed' THEN 'Completed'
                                ELSE i.Status 
                            END
                        FROM dbo.Transactions t
                        INNER JOIN inserted i ON t.TransactionId = i.TransactionId
                        INNER JOIN deleted d ON t.TransactionId = d.TransactionId;
                    END;
                `);
                console.log('Created TR_Transactions_UpdatedAt trigger');
            }
            
            const triggerCheck2 = await pool.request().query(`
                SELECT OBJECT_ID('TR_Transactions_Status', 'TR') as TriggerId
            `);
            if (!triggerCheck2.recordset[0].TriggerId) {
                await pool.request().query(`
                    CREATE TRIGGER TR_Transactions_Status
                    ON dbo.Transactions
                    AFTER UPDATE
                    AS
                    BEGIN
                        SET NOCOUNT ON;
                        
                        IF EXISTS (
                            SELECT 1 FROM deleted d
                            INNER JOIN inserted i ON d.TransactionId = i.TransactionId
                            WHERE d.Status = 'Completed' AND i.Status <> 'Completed'
                        )
                        BEGIN
                            -- Revert any attempts to change status from Completed
                            UPDATE dbo.Transactions
                            SET Status = 'Completed'
                            FROM dbo.Transactions t
                            INNER JOIN deleted d ON t.TransactionId = d.TransactionId
                            WHERE d.Status = 'Completed';
                            
                            PRINT 'WARNING: Attempt to change status from Completed was prevented';
                        END
                    END;
                `);
                console.log('Created TR_Transactions_Status trigger');
            }
            
            return true;
        }

        // Create new Transactions table if it doesn't exist
        await pool.request().query(`
            CREATE TABLE dbo.Transactions (
                TransactionId INT IDENTITY(1,1) PRIMARY KEY,
                ApplicationId INT NOT NULL,
                Amount DECIMAL(10,2) NOT NULL,
                Currency VARCHAR(3) DEFAULT 'PHP',
                Status VARCHAR(50) NOT NULL DEFAULT 'Pending',
                PaymentMethod VARCHAR(50) NULL,
                ReferenceNumber VARCHAR(100) NULL,
                PaymentDate DATETIME NULL,
                PaymentProof NVARCHAR(MAX) NULL,
                PaymentVerified BIT DEFAULT 0,
                VerifiedBy INT NULL,
                VerificationDate DATETIME NULL,
                CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
                UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
                CONSTRAINT FK_Transactions_Applications 
                    FOREIGN KEY (ApplicationId) 
                    REFERENCES dbo.Applications(ApplicationId),
                CONSTRAINT FK_Transactions_VerifiedBy
                    FOREIGN KEY (VerifiedBy)
                    REFERENCES dbo.Users(UserId),
                CONSTRAINT CK_Transactions_Status 
                    CHECK (Status IN ('Pending', 'Sent', 'Completed', 'Cancelled')),
                CONSTRAINT CK_Transactions_PaymentMethod 
                    CHECK (PaymentMethod IN ('GCash', 'Cash', 'Bank Transfer', NULL))
            );
        `);

        // Create update timestamp trigger - ensuring it doesn't affect status
        await pool.request().query(`
            CREATE TRIGGER TR_Transactions_UpdatedAt
            ON dbo.Transactions
            AFTER UPDATE
            AS
            BEGIN
                SET NOCOUNT ON;
                
                -- Only update timestamp - don't change status if already set to Completed
                UPDATE dbo.Transactions
                SET UpdatedAt = GETDATE(),
                    -- Ensure status remains Completed if it was already set to that
                    Status = CASE 
                        WHEN i.Status = 'Completed' THEN 'Completed'
                        WHEN d.Status = 'Completed' AND i.Status <> 'Completed' THEN 'Completed'
                        ELSE i.Status 
                    END
                FROM dbo.Transactions t
                INNER JOIN inserted i ON t.TransactionId = i.TransactionId
                INNER JOIN deleted d ON t.TransactionId = d.TransactionId;
            END;
        `);

        // Create a trigger to protect Completed status from being changed
        await pool.request().query(`
            CREATE TRIGGER TR_Transactions_Status
            ON dbo.Transactions
            AFTER UPDATE
            AS
            BEGIN
                SET NOCOUNT ON;
                
                IF EXISTS (
                    SELECT 1 FROM deleted d
                    INNER JOIN inserted i ON d.TransactionId = i.TransactionId
                    WHERE d.Status = 'Completed' AND i.Status <> 'Completed'
                )
                BEGIN
                    -- Revert any attempts to change status from Completed
                    UPDATE dbo.Transactions
                    SET Status = 'Completed'
                    FROM dbo.Transactions t
                    INNER JOIN deleted d ON t.TransactionId = d.TransactionId
                    WHERE d.Status = 'Completed';
                    
                    PRINT 'WARNING: Attempt to change status from Completed was prevented';
                END
            END;
        `);

        // Insert initial transactions in a separate query
        await pool.request().query(`
            INSERT INTO dbo.Transactions (ApplicationId, Amount, Status, CreatedAt, UpdatedAt)
            SELECT 
                a.ApplicationId,
                s.Price,
                'Pending',
                GETDATE(),
                GETDATE()
            FROM dbo.Applications a
            JOIN dbo.Services s ON a.ServiceId = s.ServiceId
            WHERE NOT EXISTS (
                SELECT 1 FROM dbo.Transactions t 
                WHERE t.ApplicationId = a.ApplicationId
            );
        `);

        console.log('Transactions table created successfully with protection for Completed status');
        return true;
    } catch (error) {
        console.error('Error creating Transactions table:', error);
        throw error;
    }
}

async function createReviewsTable(pool) {
    try {
        // Check if table exists and create it if it doesn't
        await pool.request().query(`
            IF OBJECT_ID('dbo.Reviews', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.Reviews (
                    ReviewId INT IDENTITY(1,1) PRIMARY KEY,
                    ApplicationId INT NOT NULL,
                    Rating INT NOT NULL,
                    ReviewText NVARCHAR(1000),
                    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
                    CONSTRAINT FK_Reviews_Applications 
                        FOREIGN KEY (ApplicationId) 
                        REFERENCES dbo.Applications(ApplicationId),
                    CONSTRAINT CK_Reviews_Rating
                        CHECK (Rating BETWEEN 1 AND 5)
                );
                
                CREATE INDEX IX_Reviews_ApplicationId ON dbo.Reviews(ApplicationId);
            END
        `);
        
        console.log('Reviews table created or verified successfully');
        return true;
    } catch (error) {
        console.error('Error creating Reviews table:', error);
        throw error;
    }
}

// Add functions to create messaging tables
async function createConversationsTable(pool) {
    try {
        const tableExists = await checkTableExists(pool, 'Conversations');
        
        if (!tableExists) {
            console.log('Creating Conversations table...');
            await pool.request().query(`
                CREATE TABLE dbo.Conversations (
                    ConversationId INT IDENTITY(1,1) PRIMARY KEY,
                    User1Id INT NOT NULL,
                    User2Id INT NOT NULL,
                    CreatedAt DATETIME DEFAULT GETDATE(),
                    UpdatedAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (User1Id) REFERENCES Users(UserId),
                    FOREIGN KEY (User2Id) REFERENCES Users(UserId),
                    CONSTRAINT UK_Users UNIQUE (User1Id, User2Id)
                )
            `);
            console.log('Conversations table created successfully');
        } else {
            console.log('Conversations table already exists');
        }
    } catch (error) {
        console.error('Error creating Conversations table:', error);
        throw error;
    }
}

async function createMessagesTable(pool) {
    try {
        const tableExists = await checkTableExists(pool, 'Messages');
        
        if (!tableExists) {
            console.log('Creating Messages table...');
            await pool.request().query(`
                CREATE TABLE dbo.Messages (
                    MessageId INT IDENTITY(1,1) PRIMARY KEY,
                    ConversationId INT NOT NULL,
                    SenderId INT NOT NULL,
                    Content NVARCHAR(MAX) NOT NULL,
                    IsRead BIT DEFAULT 0,
                    CreatedAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (ConversationId) REFERENCES Conversations(ConversationId),
                    FOREIGN KEY (SenderId) REFERENCES Users(UserId)
                )
            `);
            console.log('Messages table created successfully');
        } else {
            console.log('Messages table already exists');
        }
    } catch (error) {
        console.error('Error creating Messages table:', error);
        throw error;
    }
}

async function setupDatabase() {
    try {
        const pool = await getPool();

        // Create other tables first...
        await createUsersTable(pool);
        await createServicesTable(pool);
        await createApplicationsTable(pool);
        
        // Create Transactions table last since it depends on Applications
        await createTransactionsTable(pool);
        await createReviewsTable(pool);
        await createConversationsTable(pool);
        await createMessagesTable(pool);

        console.log('Database setup completed successfully');
        return true;
    } catch (error) {
        console.error('Error setting up database:', error);
        throw error;
    }
}

// Initial setup
getPool().then(async (pool) => {
    try {
        await setupDatabase();
    } catch (error) {
        console.error('Initial database setup failed:', error);
    }
}).catch(error => {
    console.error('Initial database connection failed:', error);
});

// Export the functions
module.exports = {
    sql,
    getPool,
    setupDatabase
};

