import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const TermsAndConditions = () => {
  return (
    <div className="min-h-screen bg-[#f8f5f0] py-10 px-4 sm:px-6">
      <div className="container mx-auto max-w-4xl">
        {/* Back button */}
        <Link to="/" className="inline-flex items-center text-[#800000] hover:text-[#6a0000] mb-6 transition-colors group">
          <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </Link>
        
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-[#800000] py-8 px-6 text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-white">Terms & Conditions</h1>
            <p className="text-[#ffd700] mt-2 italic">Last Updated: {new Date().toLocaleDateString()}</p>
          </div>
          
          {/* Content */}
          <div className="p-6 md:p-10">
            <div className="space-y-8">
              <section>
                <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 mb-4">1. Introduction</h2>
                <p className="text-gray-700 leading-relaxed">
                  Welcome to <span className="font-bold text-[#800000]">HireIT</span>, a school-based freelancing platform developed as a capstone project at <span className="font-bold">Cebu Institute of Technology University (CIT-U)</span>. These Terms & Conditions govern your access to and use of the <span className="font-bold">HireIT</span> platform. By accessing or using <span className="font-bold">HireIT</span>, you agree to comply with these Terms & Conditions.
                </p>
              </section>
              
              <section>
                <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 mb-4">2. Account Registration</h2>
                <p className="text-gray-700 leading-relaxed">
                  To access the services of <span className="font-bold text-[#800000]">HireIT</span>, users must create an account using their official school email. When registering, you agree to provide accurate, current, and complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
                </p>
              </section>
              
              <section>
                <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 mb-4">3. Use of the Platform</h2>
                <p className="text-gray-700 leading-relaxed">
                  The <span className="font-bold text-[#800000]">HireIT</span> platform is for the exclusive use of CIT-U students to post and apply for various freelance services. This capstone project aims to connect student freelancers with potential clients within the university community. You agree to use the platform solely for lawful purposes, in accordance with these Terms & Conditions, and all applicable local and university regulations.
                </p>
              </section>
              
              <section>
                <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 mb-4">4. Project Nature</h2>
                <p className="text-gray-700 leading-relaxed">
                  <span className="font-bold text-[#800000]">HireIT</span> is developed as an academic capstone project. While we strive to provide a functional and reliable platform, users acknowledge that this is a student-created application. The platform is provided to facilitate student interaction and freelance opportunities within the university as part of our academic requirements.
                </p>
              </section>
              
              <section>
                <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 mb-4">5. User Responsibilities</h2>
                <p className="text-gray-700 leading-relaxed">
                  As a user, you agree to maintain the integrity of the platform by refraining from fraudulent activities, malicious behavior, or any action that could harm the experience of other users. Users are expected to conduct themselves in a professional manner consistent with university standards and values.
                </p>
                <ul className="list-disc pl-6 mt-3 space-y-2 text-gray-700">
                  <li>Complete projects within the agreed timeframe</li>
                  <li>Communicate promptly and professionally</li>
                  <li>Provide honest reviews and feedback</li>
                  <li>Respect intellectual property rights</li>
                  <li>Report any issues or violations to the platform administrators</li>
                </ul>
              </section>
              
              <section>
                <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 mb-4">6. Payments and Transactions</h2>
                <p className="text-gray-700 leading-relaxed">
                  <span className="font-bold text-[#800000]">HireIT</span> facilitates direct transactions between users. The platform is not responsible for any payment disputes between parties. We recommend clearly defining project scope, deliverables, and payment terms before beginning any work. Users are responsible for complying with all applicable tax laws regarding income earned through the platform.
                </p>
              </section>
              
              <section>
                <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 mb-4">7. Termination</h2>
                <p className="text-gray-700 leading-relaxed">
                  We reserve the right to suspend or terminate your access to the platform if you violate any of these Terms & Conditions. Termination may also occur if you engage in prohibited activities or violate our community standards. As this is a capstone project, access may also be limited during evaluation periods or system maintenance.
                </p>
              </section>
              
              <section>
                <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 mb-4">8. Liability</h2>
                <p className="text-gray-700 leading-relaxed">
                  The <span className="font-bold text-[#800000]">HireIT</span> platform is provided "as is" and we do not guarantee its availability or performance. As a capstone project, the platform may undergo changes or updates as part of the development process. We are not responsible for any damages or losses arising from your use of the platform.
                </p>
              </section>
              
              <section>
                <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 mb-4">9. Modifications</h2>
                <p className="text-gray-700 leading-relaxed">
                  We may modify these Terms & Conditions at any time, and the changes will be effective immediately upon posting. It is your responsibility to review these terms periodically to stay informed about any changes. Significant changes to the platform may also occur as part of our capstone project development and evaluation process.
                </p>
              </section>
              
              <section>
                <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 mb-4">10. Intellectual Property</h2>
                <p className="text-gray-700 leading-relaxed">
                  The <span className="font-bold text-[#800000]">HireIT</span> platform, including its design, code, and content created by the development team, is protected by intellectual property rights. This capstone project remains the intellectual property of its student creators and Cebu Institute of Technology University. Users retain rights to their own content posted on the platform.
                </p>
              </section>
              
              <section>
                <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 mb-4">11. Governing Law</h2>
                <p className="text-gray-700 leading-relaxed">
                  These Terms & Conditions are governed by the laws of the Philippines. Any disputes will be resolved under the jurisdiction of the Philippine courts and in accordance with university policies regarding student projects and academic work.
                </p>
              </section>
            </div>
            
            {/* Agreement */}
            <div className="mt-10 p-6 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-center text-gray-700 font-medium">
                By using the <span className="font-bold text-[#800000]">HireIT</span> platform, you acknowledge that this is a capstone project and agree to these Terms & Conditions. If you do not agree with these terms, please refrain from using the platform.
              </p>
            </div>
            
            {/* Footer */}
            <div className="mt-8 text-center text-sm text-gray-500">
              <p>© {new Date().getFullYear()} HireIT Capstone Project - Cebu Institute of Technology University</p>
              <p className="mt-1">For questions or concerns regarding these terms, please contact the development team.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
