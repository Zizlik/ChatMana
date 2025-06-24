import React from 'react'
import { Link } from 'react-router-dom'
import { Home, ArrowLeft, MessageCircle } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          {/* Logo */}
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-primary-600 mb-8">
            <MessageCircle className="h-8 w-8 text-white" />
          </div>

          {/* 404 Error */}
          <h1 className="text-9xl font-bold text-gray-200 mb-4">404</h1>
          
          {/* Error Message */}
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Page not found
          </h2>
          
          <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
            Sorry, we couldn't find the page you're looking for. The page might have been moved, deleted, or you entered the wrong URL.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              <Home className="h-5 w-5 mr-2" />
              Go to Dashboard
            </Link>
            
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Go Back
            </button>
          </div>

          {/* Help Text */}
          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500">
              Need help? Contact our support team or check out our{' '}
              <a 
                href="#" 
                className="text-primary-600 hover:text-primary-500 font-medium"
              >
                help center
              </a>
              .
            </p>
          </div>

          {/* Quick Links */}
          <div className="mt-8 border-t border-gray-200 pt-8">
            <h3 className="text-sm font-medium text-gray-900 mb-4">
              Quick Links
            </h3>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link 
                to="/chats" 
                className="text-primary-600 hover:text-primary-500"
              >
                View Chats
              </Link>
              <Link 
                to="/settings" 
                className="text-primary-600 hover:text-primary-500"
              >
                Settings
              </Link>
              <a 
                href="#" 
                className="text-primary-600 hover:text-primary-500"
              >
                Help Center
              </a>
              <a 
                href="#" 
                className="text-primary-600 hover:text-primary-500"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}