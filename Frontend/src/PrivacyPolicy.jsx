import React from 'react';
import { ArrowLeft, Shield, Lock, FileText, Bell, Server, UserCheck, Cookie, Clock, RefreshCw, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const PrivacyPolicy = () => {
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
            <h1 className="text-3xl md:text-4xl font-bold text-white">Privacy Policy</h1>
            <p className="text-[#ffd700] mt-2 italic">Last Updated: {new Date().toLocaleDateString()}</p>
          </div>
          
          {/* Content */}
          <div className="p-6 md:p-10">
            <div className="mb-8 bg-[#fff9e6] p-4 border-l-4 border-[#ffd700] rounded-r-lg">
              <p className="text-gray-700">
                This Privacy Policy is part of a capstone project developed by <span className="font-bold">Group 5 ITBULAGA</span> of Grade 12 Quality at Cebu Institute of Technology University. While we've designed this policy to reflect best practices, this is an academic project.
              </p>
            </div>
            
            <div className="space-y-8">
              <section>
                <div className="flex items-center mb-4">
                  <Shield size={24} className="text-[#800000] mr-3" />
                  <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 flex-1">1. Introduction</h2>
                </div>
                <p className="text-gray-700 leading-relaxed">
                  Welcome to <span className="font-bold text-[#800000]">HireIT</span>, a school-based freelancing platform developed by <span className="font-bold">Group 5 ITBULAGA</span> of Grade 12 Quality at <span className="font-bold">Cebu Institute of Technology University (CIT-U)</span>. 
                  Your privacy is of utmost importance to us. This Privacy Policy outlines how we collect, use, and protect your personal information when using our platform. 
                  By using <span className="font-bold text-[#800000]">HireIT</span>, you agree to the terms of this policy.
                </p>
              </section>
              
              <section>
                <div className="flex items-center mb-4">
                  <FileText size={24} className="text-[#800000] mr-3" />
                  <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 flex-1">2. Information We Collect</h2>
                </div>
                <p className="text-gray-700 leading-relaxed mb-4">
                  We collect the following types of personal information when you use the <span className="font-bold text-[#800000]">HireIT</span> platform:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-5 rounded-lg border-l-4 border-[#800000]">
                    <h3 className="font-bold text-[#800000] mb-2">Account Information</h3>
                    <p className="text-gray-600">Your full name, email address, student ID, and profile details.</p>
                  </div>
                  <div className="bg-gray-50 p-5 rounded-lg border-l-4 border-[#800000]">
                    <h3 className="font-bold text-[#800000] mb-2">Service Data</h3>
                    <p className="text-gray-600">Information about the services you post, such as titles, descriptions, prices, and category.</p>
                  </div>
                  <div className="bg-gray-50 p-5 rounded-lg border-l-4 border-[#800000]">
                    <h3 className="font-bold text-[#800000] mb-2">Transaction Information</h3>
                    <p className="text-gray-600">Data related to the services you apply for, payment status, and other transaction details.</p>
                  </div>
                  <div className="bg-gray-50 p-5 rounded-lg border-l-4 border-[#800000]">
                    <h3 className="font-bold text-[#800000] mb-2">Device and Usage Data</h3>
                    <p className="text-gray-600">Information about your device, IP address, browser type, and how you interact with the platform.</p>
                  </div>
                </div>
              </section>
              
              <section>
                <div className="flex items-center mb-4">
                  <Bell size={24} className="text-[#800000] mr-3" />
                  <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 flex-1">3. How We Use Your Information</h2>
                </div>
                <p className="text-gray-700 leading-relaxed mb-4">
                  The personal information we collect is used to provide and improve our services, including:
                </p>
                <ul className="space-y-2">
                  <li className="flex">
                    <span className="text-[#800000] mr-2">•</span>
                    <span className="text-gray-700">To enable user registration and access to platform features.</span>
                  </li>
                  <li className="flex">
                    <span className="text-[#800000] mr-2">•</span>
                    <span className="text-gray-700">To process and manage service applications, payments, and transactions.</span>
                  </li>
                  <li className="flex">
                    <span className="text-[#800000] mr-2">•</span>
                    <span className="text-gray-700">To send important updates, notifications, and account-related information.</span>
                  </li>
                  <li className="flex">
                    <span className="text-[#800000] mr-2">•</span>
                    <span className="text-gray-700">To personalize user experiences and improve our platform's functionality.</span>
                  </li>
                </ul>
              </section>
              
              <section>
                <div className="flex items-center mb-4">
                  <Lock size={24} className="text-[#800000] mr-3" />
                  <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 flex-1">4. Data Security</h2>
                </div>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <p className="text-gray-700 leading-relaxed">
                    We take the security of your personal data seriously. Our platform implements reasonable administrative, technical, and physical safeguards to protect your information from unauthorized access, alteration, disclosure, or destruction. As a student capstone project, we've applied security best practices while developing HireIT.
                  </p>
                </div>
              </section>
              
              <section>
                <div className="flex items-center mb-4">
                  <Server size={24} className="text-[#800000] mr-3" />
                  <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 flex-1">5. Data Sharing and Disclosure</h2>
                </div>
                <p className="text-gray-700 leading-relaxed mb-4">
                  We do not sell, rent, or lease your personal information to third parties. However, we may share your information in the following situations:
                </p>
                <ul className="space-y-2">
                  <li className="flex">
                    <span className="text-[#800000] mr-2">•</span>
                    <span className="text-gray-700">To comply with legal obligations or requests from government authorities.</span>
                  </li>
                  <li className="flex">
                    <span className="text-[#800000] mr-2">•</span>
                    <span className="text-gray-700">To protect the rights, property, or safety of HireIT, our users, or others.</span>
                  </li>
                  <li className="flex">
                    <span className="text-[#800000] mr-2">•</span>
                    <span className="text-gray-700">With trusted service providers who assist us in operating our platform, subject to confidentiality agreements.</span>
                  </li>
                </ul>
              </section>
              
              <section>
                <div className="flex items-center mb-4">
                  <UserCheck size={24} className="text-[#800000] mr-3" />
                  <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 flex-1">6. Your Rights and Choices</h2>
                </div>
                <p className="text-gray-700 leading-relaxed mb-4">
                  As a user of <span className="font-bold text-[#800000]">HireIT</span>, you have the following rights regarding your personal information:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-5 rounded-lg border-l-4 border-[#800000]">
                    <p className="text-gray-600">The right to access, update, or delete your account information.</p>
                  </div>
                  <div className="bg-gray-50 p-5 rounded-lg border-l-4 border-[#800000]">
                    <p className="text-gray-600">The right to withdraw consent for the collection and processing of your personal information.</p>
                  </div>
                  <div className="bg-gray-50 p-5 rounded-lg border-l-4 border-[#800000]">
                    <p className="text-gray-600">The right to request a copy of your personal data in a structured, commonly used format.</p>
                  </div>
                  <div className="bg-gray-50 p-5 rounded-lg border-l-4 border-[#800000]">
                    <p className="text-gray-600">The right to opt-out of marketing communications at any time.</p>
                  </div>
                </div>
              </section>
              
              <section>
                <div className="flex items-center mb-4">
                  <Cookie size={24} className="text-[#800000] mr-3" />
                  <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 flex-1">7. Cookies and Tracking Technologies</h2>
                </div>
                <p className="text-gray-700 leading-relaxed">
                  We use cookies and other tracking technologies to enhance your experience on our platform. Cookies help us remember your preferences and provide personalized content. You can control the use of cookies through your browser settings.
                </p>
              </section>
              
              <section>
                <div className="flex items-center mb-4">
                  <Clock size={24} className="text-[#800000] mr-3" />
                  <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 flex-1">8. Data Retention</h2>
                </div>
                <p className="text-gray-700 leading-relaxed">
                  We retain your personal data for as long as necessary to provide our services, comply with legal obligations, resolve disputes, and enforce our agreements. After that, your personal data will be securely deleted or anonymized.
                </p>
              </section>
              
              <section>
                <div className="flex items-center mb-4">
                  <RefreshCw size={24} className="text-[#800000] mr-3" />
                  <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 flex-1">9. Changes to This Privacy Policy</h2>
                </div>
                <div className="bg-[#fff9e6] p-6 rounded-lg border border-[#ffd700]">
                  <p className="text-gray-700 leading-relaxed">
                    We may update this Privacy Policy from time to time as our capstone project evolves. Any changes will be posted on this page with an updated "Effective Date." We encourage you to review this policy periodically to stay informed about how we protect your information.
                  </p>
                </div>
              </section>
              
              <section>
                <div className="flex items-center mb-4">
                  <MessageCircle size={24} className="text-[#800000] mr-3" />
                  <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 flex-1">10. Contact Us</h2>
                </div>
                <p className="text-gray-700 leading-relaxed mb-4">
                  If you have any questions or concerns about this Privacy Policy or our practices, please contact us:
                </p>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <p className="text-gray-700 mb-3">
                    <span className="font-bold text-[#800000]">Email:</span> jhanmichael.mendoza@cit.edu
                  </p>
                  <p className="text-gray-700">
                    <span className="font-bold text-[#800000]">Address:</span> Cebu Institute of Technology University, N. Bacalso Avenue, Cebu City, Philippines
                  </p>
                </div>
              </section>
            </div>
            
            {/* Footer */}
            <div className="mt-8 text-center">
              <div className="p-6 bg-gradient-to-r from-[#800000] to-[#9a2a2a] rounded-lg text-white mb-4">
                <p className="opacity-90 mb-2">
                  By using <span className="font-bold">HireIT</span>, you agree to the terms of this Privacy Policy. If you do not agree with this policy, please refrain from using the platform.
                </p>
              </div>
              <div className="text-sm text-gray-500">
                <p>© {new Date().getFullYear()} HireIT - A Capstone Project by Group 5 ITBULAGA</p>
                <p className="mt-1">Grade 12 Quality | Cebu Institute of Technology University</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
