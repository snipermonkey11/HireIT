import React from 'react';
import { ArrowLeft, Users, Target, Award, MessageCircle, Mail, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

const AboutUs = () => {
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
            <h1 className="text-3xl md:text-4xl font-bold text-white">About Us</h1>
            <p className="text-[#ffd700] mt-2 italic">Group 5 ITBULAGA - Grade 12 Quality</p>
          </div>
          
          {/* Content */}
          <div className="p-6 md:p-10">
            <div className="space-y-8">
              <section>
                <div className="flex items-center mb-4">
                  <Users size={24} className="text-[#800000] mr-3" />
                  <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 flex-1">Who We Are</h2>
                </div>
                <p className="text-gray-700 leading-relaxed">
                  <span className="font-bold text-[#800000]">HireIT</span> is a school-based freelancing platform developed by <span className="font-bold">Group 5 ITBULAGA</span> of Grade 12 Quality at <span className="font-bold">Cebu Institute of Technology University (CIT-U)</span>. 
                  This capstone project was created to provide a space where students can offer and avail of various freelance services in a safe and trusted environment. 
                  Whether you're a freelancer offering skills in areas like writing, graphic design, tutoring, or any other service, or a client in need of skilled individuals, <span className="font-bold text-[#800000]">HireIT</span> connects the two in an efficient and easy-to-use platform.
                </p>
              </section>
              
              <section>
                <div className="flex items-center mb-4">
                  <Target size={24} className="text-[#800000] mr-3" />
                  <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 flex-1">Our Mission</h2>
                </div>
                <p className="text-gray-700 leading-relaxed">
                  At <span className="font-bold text-[#800000]">HireIT</span>, our mission is to foster a collaborative environment where students at <span className="font-bold">CIT-U</span> can connect with each other and share their talents, skills, and expertise. 
                  By providing a space for individuals to find meaningful freelance opportunities, we aim to help students develop professional skills, earn income, and build their portfolios while still in school.
                </p>
              </section>
              
              <section>
                <div className="flex items-center mb-4">
                  <Award size={24} className="text-[#800000] mr-3" />
                  <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 flex-1">Our Vision</h2>
                </div>
                <p className="text-gray-700 leading-relaxed">
                  Our vision is to create an innovative platform that empowers students to develop entrepreneurial skills through freelancing. We aim to foster a community where students can gain real-world experience, build their professional networks, and earn income while completing their education at CIT-U.
                </p>
              </section>
              
              <section>
                <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 mb-4">Why HireIT?</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  <span className="font-bold text-[#800000]">HireIT</span> stands out because it is built for students by students. As a capstone project developed by Group 5 ITBULAGA, we understand the unique needs of our fellow students:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="bg-gray-50 p-5 rounded-lg border-l-4 border-[#800000]">
                    <h3 className="font-bold text-[#800000] mb-2">Secure Transactions</h3>
                    <p className="text-gray-600">Your privacy and security are our top priority. We ensure that all transactions on the platform are conducted safely.</p>
                  </div>
                  <div className="bg-gray-50 p-5 rounded-lg border-l-4 border-[#800000]">
                    <h3 className="font-bold text-[#800000] mb-2">Student-Focused</h3>
                    <p className="text-gray-600">Designed specifically for CIT-U students, ensuring a personalized experience and access to a network of trusted peers.</p>
                  </div>
                  <div className="bg-gray-50 p-5 rounded-lg border-l-4 border-[#800000]">
                    <h3 className="font-bold text-[#800000] mb-2">Wide Range of Services</h3>
                    <p className="text-gray-600">From tutoring to graphic design, writing to programming, find skilled student freelancers for any project.</p>
                  </div>
                  <div className="bg-gray-50 p-5 rounded-lg border-l-4 border-[#800000]">
                    <h3 className="font-bold text-[#800000] mb-2">User-Friendly Interface</h3>
                    <p className="text-gray-600">Our intuitive platform makes it easy to browse services, apply for opportunities, and process payments.</p>
                  </div>
                </div>
              </section>
              
              <section>
                <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 mb-6">Meet Group 5 ITBULAGA</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow-md overflow-hidden transition-transform hover:scale-105">
                    <div className="h-36 bg-gradient-to-r from-[#800000] to-[#9a2a2a] flex items-center justify-center">
                      <span className="text-3xl text-white font-bold">JM</span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-[#800000]">Jhan Michael S. Mendoza</h3>
                      <p className="text-gray-600 text-sm">Full-Stack Developer</p>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow-md overflow-hidden transition-transform hover:scale-105">
                    <div className="h-36 bg-gradient-to-r from-[#800000] to-[#9a2a2a] flex items-center justify-center">
                      <span className="text-3xl text-white font-bold">LJ</span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-[#800000]">Lotes Jean G. Lanticse</h3>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow-md overflow-hidden transition-transform hover:scale-105">
                    <div className="h-36 bg-gradient-to-r from-[#800000] to-[#9a2a2a] flex items-center justify-center">
                      <span className="text-3xl text-white font-bold">EJ</span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-[#800000]">Earl Jedd D. Lastimosa</h3>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow-md overflow-hidden transition-transform hover:scale-105">
                    <div className="h-36 bg-gradient-to-r from-[#800000] to-[#9a2a2a] flex items-center justify-center">
                      <span className="text-3xl text-white font-bold">CK</span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-[#800000]">Ceejhay King B. Camingue</h3>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow-md overflow-hidden transition-transform hover:scale-105">
                    <div className="h-36 bg-gradient-to-r from-[#800000] to-[#9a2a2a] flex items-center justify-center">
                      <span className="text-3xl text-white font-bold">CS</span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-[#800000]">Clark Steven C. Jugan</h3>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow-md overflow-hidden transition-transform hover:scale-105">
                    <div className="h-36 bg-gradient-to-r from-[#800000] to-[#9a2a2a] flex items-center justify-center">
                      <span className="text-3xl text-white font-bold">JD</span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-[#800000]">Jhonlee Don S. Duran</h3>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow-md overflow-hidden transition-transform hover:scale-105">
                    <div className="h-36 bg-gradient-to-r from-[#800000] to-[#9a2a2a] flex items-center justify-center">
                      <span className="text-3xl text-white font-bold">II</span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-[#800000]">Isaac Irving S. Laputan</h3>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow-md overflow-hidden transition-transform hover:scale-105">
                    <div className="h-36 bg-gradient-to-r from-[#800000] to-[#9a2a2a] flex items-center justify-center">
                      <span className="text-3xl text-white font-bold">GS</span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-[#800000]">Gelou B. Stomo</h3>
                    </div>
                  </div>
                </div>
              </section>
              
              <section>
                <div className="flex items-center mb-4">
                  <MessageCircle size={24} className="text-[#800000] mr-3" />
                  <h2 className="text-2xl font-bold text-[#800000] border-b border-gray-200 pb-2 flex-1">Contact Us</h2>
                </div>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="flex items-start mb-4">
                    <Mail className="text-[#800000] mr-3 mt-1 flex-shrink-0" size={20} />
                    <div>
                      <h3 className="font-bold text-gray-700">Email</h3>
                      <p className="text-gray-600">jhanmichael.mendoza@cit.edu</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <MapPin className="text-[#800000] mr-3 mt-1 flex-shrink-0" size={20} />
                    <div>
                      <h3 className="font-bold text-gray-700">Address</h3>
                      <p className="text-gray-600">Cebu Institute of Technology University, N. Bacalso Avenue, Cebu City, Philippines</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
            
            {/* Call to Action */}
            <div className="mt-10 p-6 bg-gradient-to-r from-[#800000] to-[#9a2a2a] rounded-lg text-center">
              <h3 className="text-xl font-bold text-white mb-2">Join HireIT Today!</h3>
              <p className="text-white opacity-90 mb-4">Become part of the growing freelancing community at CIT-U.</p>
              <Link 
                to="/register" 
                className="inline-block px-6 py-3 bg-[#ffd700] text-[#800000] font-bold rounded-md hover:bg-[#e6c200] transition-colors"
              >
                Get Started
              </Link>
            </div>
            
            {/* Footer */}
            <div className="mt-8 text-center text-sm text-gray-500">
              <p>© {new Date().getFullYear()} HireIT - A Capstone Project by Group 5 ITBULAGA</p>
              <p className="mt-1">Grade 12 Quality | Cebu Institute of Technology University</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;
