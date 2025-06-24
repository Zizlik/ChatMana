import React, { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { 
  User, 
  Bell, 
  Shield, 
  Smartphone,
  Facebook,
  MessageSquare,
  Instagram,
  Settings,
  Save,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { profileUpdateSchema, type ProfileUpdateFormData } from '../utils/validation'

export function SettingsPage() {
  const { user, updateProfile, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [updateSuccess, setUpdateSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<ProfileUpdateFormData>({
    resolver: yupResolver(profileUpdateSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      companyName: user?.companyName || '',
    }
  })

  const onSubmit = async (data: ProfileUpdateFormData) => {
    try {
      setIsSubmitting(true)
      setUpdateSuccess(false)
      await updateProfile(data)
      setUpdateSuccess(true)
      // Reset password fields
      reset({
        ...data,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      })
      setTimeout(() => setUpdateSuccess(false), 3000)
    } catch (error) {
      // Error is handled by the auth context
    } finally {
      setIsSubmitting(false)
    }
  }

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'integrations', name: 'Integrations', icon: Smartphone },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Shield },
  ]

  const integrations = [
    {
      id: 'facebook',
      name: 'Facebook',
      icon: Facebook,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      connected: true,
      description: 'Manage Facebook Messenger conversations'
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      icon: MessageSquare,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      connected: false,
      description: 'Connect WhatsApp Business API'
    },
    {
      id: 'instagram',
      name: 'Instagram',
      icon: Instagram,
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
      connected: false,
      description: 'Manage Instagram Direct Messages'
    }
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="text-gray-600">
                Manage your account settings and preferences.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-x-5">
          {/* Sidebar */}
          <aside className="py-6 px-2 sm:px-6 lg:py-0 lg:px-0 lg:col-span-3">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`${
                      activeTab === tab.id
                        ? 'bg-primary-50 border-primary-500 text-primary-700'
                        : 'border-transparent text-gray-900 hover:bg-gray-50 hover:text-gray-900'
                    } group border-l-4 px-3 py-2 flex items-center text-sm font-medium w-full`}
                  >
                    <Icon
                      className={`${
                        activeTab === tab.id ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'
                      } flex-shrink-0 -ml-1 mr-3 h-6 w-6`}
                    />
                    <span className="truncate">{tab.name}</span>
                  </button>
                )
              })}
            </nav>
          </aside>

          {/* Main content */}
          <div className="space-y-6 sm:px-6 lg:px-0 lg:col-span-9">
            {activeTab === 'profile' && (
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="shadow sm:rounded-md sm:overflow-hidden">
                  <div className="bg-white py-6 px-4 sm:p-6">
                    <div>
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Profile Information
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Update your personal information and account details.
                      </p>
                    </div>

                    {updateSuccess && (
                      <div className="mt-4 rounded-md bg-green-50 p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <Check className="h-5 w-5 text-green-400" />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-green-800">
                              Profile updated successfully!
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-6 grid grid-cols-6 gap-6">
                      <div className="col-span-6 sm:col-span-3">
                        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                          First name
                        </label>
                        <input
                          {...register('firstName')}
                          type="text"
                          className="mt-1 input w-full"
                        />
                        {errors.firstName && (
                          <p className="mt-1 text-sm text-error-600">{errors.firstName.message}</p>
                        )}
                      </div>

                      <div className="col-span-6 sm:col-span-3">
                        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                          Last name
                        </label>
                        <input
                          {...register('lastName')}
                          type="text"
                          className="mt-1 input w-full"
                        />
                        {errors.lastName && (
                          <p className="mt-1 text-sm text-error-600">{errors.lastName.message}</p>
                        )}
                      </div>

                      <div className="col-span-6 sm:col-span-4">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                          Email address
                        </label>
                        <input
                          {...register('email')}
                          type="email"
                          className="mt-1 input w-full"
                        />
                        {errors.email && (
                          <p className="mt-1 text-sm text-error-600">{errors.email.message}</p>
                        )}
                      </div>

                      <div className="col-span-6 sm:col-span-4">
                        <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                          Company name
                        </label>
                        <input
                          {...register('companyName')}
                          type="text"
                          className="mt-1 input w-full"
                        />
                        {errors.companyName && (
                          <p className="mt-1 text-sm text-error-600">{errors.companyName.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Password Change Section */}
                    <div className="mt-8 border-t border-gray-200 pt-8">
                      <h4 className="text-lg leading-6 font-medium text-gray-900">
                        Change Password
                      </h4>
                      <p className="mt-1 text-sm text-gray-500">
                        Leave blank if you don't want to change your password.
                      </p>

                      <div className="mt-6 grid grid-cols-6 gap-6">
                        <div className="col-span-6 sm:col-span-3">
                          <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                            Current password
                          </label>
                          <div className="mt-1 relative">
                            <input
                              {...register('currentPassword')}
                              type={showCurrentPassword ? 'text' : 'password'}
                              className="input w-full pr-10"
                            />
                            <button
                              type="button"
                              className="absolute inset-y-0 right-0 pr-3 flex items-center"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            >
                              {showCurrentPassword ? (
                                <EyeOff className="h-4 w-4 text-gray-400" />
                              ) : (
                                <Eye className="h-4 w-4 text-gray-400" />
                              )}
                            </button>
                          </div>
                          {errors.currentPassword && (
                            <p className="mt-1 text-sm text-error-600">{errors.currentPassword.message}</p>
                          )}
                        </div>

                        <div className="col-span-6 sm:col-span-3">
                          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                            New password
                          </label>
                          <div className="mt-1 relative">
                            <input
                              {...register('newPassword')}
                              type={showNewPassword ? 'text' : 'password'}
                              className="input w-full pr-10"
                            />
                            <button
                              type="button"
                              className="absolute inset-y-0 right-0 pr-3 flex items-center"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                            >
                              {showNewPassword ? (
                                <EyeOff className="h-4 w-4 text-gray-400" />
                              ) : (
                                <Eye className="h-4 w-4 text-gray-400" />
                              )}
                            </button>
                          </div>
                          {errors.newPassword && (
                            <p className="mt-1 text-sm text-error-600">{errors.newPassword.message}</p>
                          )}
                        </div>

                        <div className="col-span-6 sm:col-span-3">
                          <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700">
                            Confirm new password
                          </label>
                          <input
                            {...register('confirmNewPassword')}
                            type="password"
                            className="mt-1 input w-full"
                          />
                          {errors.confirmNewPassword && (
                            <p className="mt-1 text-sm text-error-600">{errors.confirmNewPassword.message}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn btn-primary inline-flex items-center"
                    >
                      {isSubmitting ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {activeTab === 'integrations' && (
              <div className="shadow sm:rounded-md sm:overflow-hidden">
                <div className="bg-white py-6 px-4 sm:p-6">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Social Media Integrations
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Connect your social media accounts to manage conversations from one place.
                    </p>
                  </div>

                  <div className="mt-6 space-y-6">
                    {integrations.map((integration) => {
                      const Icon = integration.icon
                      return (
                        <div key={integration.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div className={`p-2 rounded-lg ${integration.bgColor}`}>
                              <Icon className={`h-6 w-6 ${integration.color}`} />
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-gray-900">
                                {integration.name}
                              </h4>
                              <p className="text-sm text-gray-500">
                                {integration.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            {integration.connected ? (
                              <>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <Check className="h-3 w-3 mr-1" />
                                  Connected
                                </span>
                                <button className="btn btn-outline btn-sm">
                                  Disconnect
                                </button>
                              </>
                            ) : (
                              <button className="btn btn-primary btn-sm">
                                Connect
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <AlertCircle className="h-5 w-5 text-blue-400" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800">
                          Integration Setup
                        </h3>
                        <div className="mt-2 text-sm text-blue-700">
                          <p>
                            To connect your social media accounts, you'll need to authorize our application 
                            to access your business accounts. This allows us to receive and respond to messages 
                            on your behalf.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="shadow sm:rounded-md sm:overflow-hidden">
                <div className="bg-white py-6 px-4 sm:p-6">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Notification Preferences
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Choose how you want to be notified about new messages and updates.
                    </p>
                  </div>

                  <div className="mt-6 space-y-6">
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="email-notifications"
                          name="email-notifications"
                          type="checkbox"
                          defaultChecked
                          className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="email-notifications" className="font-medium text-gray-700">
                          Email notifications
                        </label>
                        <p className="text-gray-500">Get notified via email when you receive new messages.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="browser-notifications"
                          name="browser-notifications"
                          type="checkbox"
                          defaultChecked
                          className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="browser-notifications" className="font-medium text-gray-700">
                          Browser notifications
                        </label>
                        <p className="text-gray-500">Show desktop notifications for new messages.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="sound-notifications"
                          name="sound-notifications"
                          type="checkbox"
                          className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="sound-notifications" className="font-medium text-gray-700">
                          Sound notifications
                        </label>
                        <p className="text-gray-500">Play a sound when new messages arrive.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
                  <button className="btn btn-primary">
                    Save Preferences
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="shadow sm:rounded-md sm:overflow-hidden">
                <div className="bg-white py-6 px-4 sm:p-6">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Security Settings
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Manage your account security and privacy settings.
                    </p>
                  </div>

                  <div className="mt-6 space-y-6">
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          Two-Factor Authentication
                        </h4>
                        <p className="text-sm text-gray-500">
                          Add an extra layer of security to your account.
                        </p>
                      </div>
                      <button className="btn btn-outline btn-sm">
                        Enable 2FA
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          Active Sessions
                        </h4>
                        <p className="text-sm text-gray-500">
                          Manage devices that are currently signed in.
                        </p>
                      </div>
                      <button className="btn btn-outline btn-sm">
                        View Sessions
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          API Keys
                        </h4>
                        <p className="text-sm text-gray-500">
                          Manage API keys for third-party integrations.
                        </p>
                      </div>
                      <button className="btn btn-outline btn-sm">
                        Manage Keys
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}