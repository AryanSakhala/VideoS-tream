import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Upload, Video, Clock } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.name}!
        </h1>
        <p className="text-gray-600 mt-1">
          Role: <span className="font-medium capitalize">{user?.role}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Video className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Videos
                </dt>
                <dd className="text-2xl font-semibold text-gray-900">-</dd>
              </dl>
            </div>
          </div>
          <div className="mt-4">
            <Link to="/videos" className="text-sm text-primary-600 hover:text-primary-700">
              View all →
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Processing
                </dt>
                <dd className="text-2xl font-semibold text-gray-900">-</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Upload className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Quick Upload
                </dt>
              </dl>
            </div>
          </div>
          <div className="mt-4">
            <Link
              to="/upload"
              className="btn btn-primary w-full"
            >
              Upload Video
            </Link>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Getting Started</h2>
        <ul className="space-y-2 text-gray-700">
          <li>• Upload your first video from the Upload page</li>
          <li>• View all your videos in the Video Library</li>
          <li>• Videos are automatically processed for content sensitivity</li>
          <li>• Real-time updates will appear as videos process</li>
        </ul>
      </div>
    </div>
  );
}

