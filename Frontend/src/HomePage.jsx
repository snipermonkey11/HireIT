import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brush, Camera, Edit, BookOpen, GraduationCap } from 'lucide-react';

const HomePage = () => {
  return (
    <div className="bg-[#f8f5f0] text-gray-800 pt-20">

      {/* Hero Section */}
      <section className="relative bg-[#800000] text-white py-24 px-8 text-center overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: 'url(https://via.placeholder.com/1920x1080)' }}></div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#800000] via-[#800000] to-transparent opacity-60"></div>
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6 text-white">Empowering Students to Freelance and Collaborate</h1>
          <p className="text-lg md:text-xl mb-8 text-white opacity-90">Whether you need help with a project or want to offer a service, HireIT gives you the flexibility to do both!</p>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-4 md:px-8 text-center bg-white shadow-sm">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-10 text-[#800000]">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <motion.div
              className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border-t-4 border-[#800000]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="w-12 h-12 bg-[#800000] bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-[#800000]">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-4 text-[#800000]">Step 1: Sign Up</h3>
              <p className="text-gray-600">Create your student profile on HireIT and get started! It's quick and simple.</p>
            </motion.div>

            <motion.div
              className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border-t-4 border-[#800000]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="w-12 h-12 bg-[#800000] bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-[#800000]">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-4 text-[#800000]">Step 2: Offer Services or Post Projects</h3>
              <p className="text-gray-600">You can both offer services as a freelancer and post projects as a client. It's all up to you!</p>
            </motion.div>

            <motion.div
              className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border-t-4 border-[#800000]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="w-12 h-12 bg-[#800000] bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-[#800000]">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-4 text-[#800000]">Step 3: Work Together</h3>
              <p className="text-gray-600">Apply for services or collaborate with clients. Whether you're a freelancer or a client, there's always work to be done!</p>
            </motion.div>

            <motion.div
              className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border-t-4 border-[#800000]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <div className="w-12 h-12 bg-[#800000] bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-[#800000]">4</span>
              </div>
              <h3 className="text-xl font-semibold mb-4 text-[#800000]">Step 4: Get Paid</h3>
              <p className="text-gray-600">Once the work is done, get paid for your services or pay for the projects you post. It's that simple!</p>
            </motion.div>
          </div>
        </div>
      </section>


      {/* Featured Categories Section */}
      <section className="py-16 px-4 md:px-8 text-center">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-10 text-[#800000]">Popular Categories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <motion.div
              className="bg-white p-6 shadow-md rounded-xl hover:shadow-lg transition-all duration-300 flex flex-col items-center border-b-4 border-[#ffd700]"
              whileHover={{ y: -5 }}
            >
              <div className="w-14 h-14 bg-[#ffd700] bg-opacity-20 rounded-full flex items-center justify-center mb-4">
                <Brush size={24} className="text-[#800000]" />
              </div>
              <h3 className="font-semibold text-xl mb-4 text-[#800000]">Art</h3>
              <p className="text-gray-600">Freelancers offering or clients needing creative artwork.</p>
            </motion.div>
            
            <motion.div
              className="bg-white p-6 shadow-md rounded-xl hover:shadow-lg transition-all duration-300 flex flex-col items-center border-b-4 border-[#ffd700]"
              whileHover={{ y: -5 }}
            >
              <div className="w-14 h-14 bg-[#ffd700] bg-opacity-20 rounded-full flex items-center justify-center mb-4">
                <Camera size={24} className="text-[#800000]" />
              </div>
              <h3 className="font-semibold text-xl mb-4 text-[#800000]">Photography</h3>
              <p className="text-gray-600">Find photographers for your projects or offer your services.</p>
            </motion.div>
            
            <motion.div
              className="bg-white p-6 shadow-md rounded-xl hover:shadow-lg transition-all duration-300 flex flex-col items-center border-b-4 border-[#ffd700]"
              whileHover={{ y: -5 }}
            >
              <div className="w-14 h-14 bg-[#ffd700] bg-opacity-20 rounded-full flex items-center justify-center mb-4">
                <Edit size={24} className="text-[#800000]" />
              </div>
              <h3 className="font-semibold text-xl mb-4 text-[#800000]">Editing</h3>
              <p className="text-gray-600">Offer your editing skills or hire an editor for your project.</p>
            </motion.div>
            
            <motion.div
              className="bg-white p-6 shadow-md rounded-xl hover:shadow-lg transition-all duration-300 flex flex-col items-center border-b-4 border-[#ffd700]"
              whileHover={{ y: -5 }}
            >
              <div className="w-14 h-14 bg-[#ffd700] bg-opacity-20 rounded-full flex items-center justify-center mb-4">
                <BookOpen size={24} className="text-[#800000]" />
              </div>
              <h3 className="font-semibold text-xl mb-4 text-[#800000]">Writing</h3>
              <p className="text-gray-600">Hire writers or offer writing services for various needs.</p>
            </motion.div>
            
            <motion.div
              className="bg-white p-6 shadow-md rounded-xl hover:shadow-lg transition-all duration-300 flex flex-col items-center border-b-4 border-[#ffd700]"
              whileHover={{ y: -5 }}
            >
              <div className="w-14 h-14 bg-[#ffd700] bg-opacity-20 rounded-full flex items-center justify-center mb-4">
                <GraduationCap size={24} className="text-[#800000]" />
              </div>
              <h3 className="font-semibold text-xl mb-4 text-[#800000]">Tutoring</h3>
              <p className="text-gray-600">Offer tutoring services or hire a tutor to improve your skills.</p>
            </motion.div>
          </div>
        </div>
      </section>

   

      {/* Footer Section */}
      <footer className="bg-[#800000] text-white py-8 text-center mt-10">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-center space-y-4 md:space-y-0 md:space-x-8 mb-6">
            <Link to="/about" className="hover:text-[#ffd700] transition-colors duration-200">About Us</Link>
            <Link to="/terms" className="hover:text-[#ffd700] transition-colors duration-200">Terms and Conditions</Link>
            <Link to="/privacy" className="hover:text-[#ffd700] transition-colors duration-200">Privacy Policy</Link>
          </div>
          <p className="text-sm opacity-80">&copy; 2025 HireIT. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
};

export default HomePage;
