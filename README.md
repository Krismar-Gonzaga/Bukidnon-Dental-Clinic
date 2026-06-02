# 🦷 Bukidnon Dental Portal

A comprehensive, multi-platform dental clinic management system with centralized backend, web dashboard, and mobile patient application.

## 📋 Table of Contents
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Folder Structure](#folder-structure)
- [Prerequisites](#prerequisites)
- [Installation Guide](#installation-guide)
  - [Backend Setup (Laravel)](#backend-setup-laravel)
  - [Web Frontend Setup (React.js)](#web-frontend-setup-reactjs)
  - [Mobile App Setup (React Native)](#mobile-app-setup-react-native)
- [Database Configuration](#database-configuration)
- [API Integration](#api-integration)
- [Running the Applications](#running-the-applications)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)
- [Technical Specifications](#technical-specifications)

## 🏗️ System Architecture

The Bukidnon Dental Portal follows a **three-tier architecture** with separate concerns:










## 🛠️ Technology Stack

### Backend Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| **Laravel** | 10.x/11.x | Main backend framework handling authentication, appointment processing, patient records, billing, inventory management, notifications, clinic verification, role-based access control |
| **PHP** | 8.1+ | Server-side programming language |
| **MySQL/PostgreSQL** | 8.0+ | Production database (via Supabase) |

### Web Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React.js** | 18.x | Component-based web interface for administrators, clinic staff, and dentists |
| **Node.js** | 18.x+ | JavaScript runtime for development |
| **npm/yarn** | Latest | Package management |

### Mobile Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React Native** | 0.72+ | Cross-platform mobile development for Android/iOS |
| **Expo** | 49+ | Development framework for React Native |
| **Node.js** | 18.x+ | JavaScript runtime |

### Database Systems
| Technology | Purpose |
|------------|---------|
| **Supabase** | Main centralized cloud database (PostgreSQL-based) with real-time synchronization |
| **SQLite** | Local offline database for mobile app data persistence |

### API & Integration
| Technology | Purpose |
|------------|---------|
| **RESTful API** | Communication between Laravel backend, React.js web, React Native mobile, and Supabase |
| **Laravel Sanctum** | API authentication and token management |
| **CORS** | Cross-origin resource sharing configuration |

## 📁 Folder Structure










## 📋 Prerequisites

Before installation, ensure you have the following:

### Required Software
- **Git** - Version control
- **Node.js** (v18 or higher) - JavaScript runtime
- **npm** or **yarn** - Package managers
- **PHP** (v8.1 or higher) - For Laravel backend
- **Composer** - PHP dependency manager
- **Android Studio** (for mobile development)
- **VS Code** or preferred IDE

### Optional
- **XAMPP/WAMP/MAMP** - Local PHP development
- **Android/iOS device** - For mobile testing
- **Expo Go** app - For mobile development (iOS/Android)

## 🚀 Installation Guide

### 1. Clone the Repository

```bash
git clone https://github.com/Krismar-Gonzaga/Bukidnon-Dental-Clinic.git
cd Bukidnon-Dental-Clinic











## Backend Setup (Laravel)

# Navigate to backend folder
cd backend

# Install PHP dependencies
composer install

# Create environment file
cp .env.example .env

# Generate application key
php artisan key:generate

# Configure database in .env file
# DB_CONNECTION=pgsql (for Supabase)
# DB_HOST=aws-0.ap-southeast-1.pooler.supabase.com
# DB_PORT=5432
# DB_DATABASE=postgres
# DB_USERNAME=your_supabase_user
# DB_PASSWORD=your_supabase_password

# Run migrations
php artisan migrate

# Install Sanctum for API authentication
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
php artisan migrate

# Start Laravel development server
php artisan serve
# Runs on http://localhost:8000










# Web Frontend Setup (React.js)


# Navigate to web folder
cd web

# Install dependencies
npm install
# or
yarn install

# Create environment file
echo "REACT_APP_API_URL=http://localhost:8000/api" > .env

# Start development server
npm start
# or
yarn start
# Runs on http://localhost:3000










# Mobile App Setup (React Native)

# Navigate to mobile folder
cd mobile

# Install dependencies
npm install
# or
yarn install

# Install Expo CLI (if using Expo)
npm install -g expo-cli

# For pure React Native, ensure Android environment is set up
# Set JAVA_HOME (Windows example)
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-17.0.19.10-hotspot"

# Start Metro bundler
npm start
# or
yarn start

# In another terminal, run on Android
npm run android
# or
npx react-native run-android
