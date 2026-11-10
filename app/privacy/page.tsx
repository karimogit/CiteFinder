'use client'

import Link from 'next/link'
import { ArrowLeft, Shield, Eye, Lock, FileText } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-blue-100">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-blue-600/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-pink-400/20 to-orange-400/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative container mx-auto px-4 py-12">
        {/* Back Button */}
        <div className="mb-8">
          <Link 
            href="/"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>

        {/* Header */}
        <header className="text-center mb-16 animate-fade-in-up">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-glow mb-6" role="img" aria-label="Privacy Shield">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold gradient-text mb-6">
            Privacy Policy
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Your privacy is important to us. This policy explains how we collect, use, and protect your information.
          </p>
          <div className="text-sm text-gray-500 mt-4">
            Last updated: November 10, 2026
          </div>
        </header>

        {/* Content */}
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Information We Collect */}
          <section className="glass rounded-2xl shadow-soft p-8 hover-lift">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Information We Collect</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">PDF Files</h3>
                <p className="text-gray-700 leading-relaxed">
                  When you upload a PDF, CiteFinder reads it in memory to extract statements and search for sources. The file is not written to a database or file store, and it is discarded when the request finishes.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Text Input</h3>
                <p className="text-gray-700 leading-relaxed">
                  Text you paste is processed the same way. It is used to extract statements and is not saved after the request finishes.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Usage Data</h3>
                <p className="text-gray-700 leading-relaxed">
                  CiteFinder does not require an account and does not run its own analytics. The hosting provider may keep standard server logs, such as IP address and request time, for a limited period.
                </p>
              </div>
            </div>
          </section>

          {/* How We Use Your Information */}
          <section className="glass rounded-2xl shadow-soft p-8 hover-lift">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl flex items-center justify-center mr-4">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">How We Use Your Information</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p className="text-gray-700">Extract citations from your uploaded PDFs or entered text</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p className="text-gray-700">Search academic databases to find related papers</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p className="text-gray-700">Generate formatted reference lists in various citation styles</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p className="text-gray-700">Improve our citation extraction algorithms and service quality</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p className="text-gray-700">Provide technical support and respond to your inquiries</p>
              </div>
            </div>
          </section>

          {/* Data Security */}
          <section className="glass rounded-2xl shadow-soft p-8 hover-lift">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Data Security</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">No document retention</h3>
                <p className="text-gray-700 leading-relaxed">
                  Uploaded PDFs and pasted text are processed in memory for that request and are not stored by CiteFinder. Do not submit information you are not comfortable sending as a search query.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Data Processing</h3>
                <p className="text-gray-700 leading-relaxed">
                  Processing runs on our servers. To find sources, short search phrases from your text are sent to arXiv, OpenAlex, Crossref, and PubMed. The original file is not sent to those services.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Access Controls</h3>
                <p className="text-gray-700 leading-relaxed">
                  We maintain strict access controls and regularly review our security practices to ensure your data remains protected. Our team is trained on data protection best practices.
                </p>
              </div>
            </div>
          </section>

          {/* Data Sharing */}
          <section className="glass rounded-2xl shadow-soft p-8 hover-lift">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Data Sharing</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Third-Party Services</h3>
                <p className="text-gray-700 leading-relaxed">
                  We use the following third-party services to provide our functionality:
                </p>
                <ul className="mt-3 space-y-2">
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <span className="text-gray-700"><strong>Hosting provider:</strong> Runs the application and may retain standard request logs. Documents are not stored there.</span>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <span className="text-gray-700"><strong>Academic APIs:</strong> arXiv, OpenAlex, CrossRef, and PubMed for paper discovery</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Legal Requirements</h3>
                <p className="text-gray-700 leading-relaxed">
                  We may disclose your information if required by law, regulation, or legal process, or to protect our rights, property, or safety, or that of our users or the public.
                </p>
              </div>
            </div>
          </section>

          {/* Cookie Policy */}
          <section className="glass rounded-2xl shadow-soft p-8 hover-lift">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Cookie Policy</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">What Are Cookies?</h3>
                <p className="text-gray-700 leading-relaxed">
                  Cookies are small text files that a site can store on your device. CiteFinder&apos;s search flow does not use them.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">How We Use Cookies</h3>
                <p className="text-gray-700 leading-relaxed mb-4">
                  CiteFinder does not set analytics, advertising, or preference cookies. The app works without an account cookie.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Third-Party Cookies</h3>
                <p className="text-gray-700 leading-relaxed">
                  CiteFinder does not embed third-party analytics. Academic databases are contacted from our server, so your browser does not receive their cookies during a search.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Managing Cookies</h3>
                <p className="text-gray-700 leading-relaxed mb-4">
                  You can control and manage cookies in several ways:
                </p>
                <div className="space-y-2">
                  <div className="flex items-start">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <p className="text-gray-700">Browser settings: Most browsers allow you to block or delete cookies</p>
                  </div>
                  <div className="flex items-start">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <p className="text-gray-700">Opt-out tools: Use browser extensions or tools to manage cookie preferences</p>
                  </div>

                </div>
                <p className="text-gray-700 leading-relaxed mt-4">
                  Blocking cookies in your browser will not stop CiteFinder from processing a document.
                </p>
              </div>
            </div>
          </section>

          {/* Your Rights */}
          <section className="glass rounded-2xl shadow-soft p-8 hover-lift">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Your Rights</h2>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p className="text-gray-700"><strong>Access:</strong> You can request access to any personal data we hold about you</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p className="text-gray-700"><strong>Deletion:</strong> Uploaded documents are not retained, so there is no document library to delete. You can still ask us about hosting logs.</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p className="text-gray-700"><strong>Correction:</strong> You can request correction of any inaccurate personal data</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p className="text-gray-700"><strong>Portability:</strong> You can request a copy of your data in a portable format</p>
              </div>
            </div>
          </section>



          {/* Changes to Policy */}
          <section className="glass rounded-2xl shadow-soft p-8 hover-lift">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Changes to This Policy</h2>
            
            <p className="text-gray-700 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the &ldquo;Last updated&rdquo; date. We encourage you to review this Privacy Policy periodically for any changes.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
} 