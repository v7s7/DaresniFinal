# Overview

This is a comprehensive online tutoring system built with React.js and Express.js, designed to connect students with verified tutors for scheduled learning sessions. The platform supports user authentication, session booking, real-time messaging, file uploads, and administrative oversight. Students can browse and book tutors across various subjects, while tutors can manage their profiles and schedules. Administrators oversee tutor verification and platform management.

# Recent Changes (October 2025)

## Profile Settings Feature
- Created comprehensive Profile Settings page allowing users to:
  - Edit first name and last name
  - Upload profile pictures to object storage (max 5MB, image files only)
  - View email and role (read-only)
- Backend API endpoint (PUT /api/user/profile) with validation for firstName, lastName, and profileImageUrl
- File upload endpoint (POST /api/upload) using multer and object storage
- Auth context refresh integration - user data updates immediately after profile changes
- Dashboard welcome message now displays user's first name dynamically

## My Sessions Page
- Implemented role-specific session display:
  - Students see tutor information (name, profile picture)
  - Tutors see student information (name, profile picture)
  - Admins see both student and tutor information
- Session filtering by status (upcoming, past, cancelled)
- Backend API optimization with separate queries for admin role to avoid table alias conflicts

## Tutor Profile & Favorites Features (October 17, 2025)
- **Fixed TutorProfile data loading**: Corrected queryKey from `["/api", "tutors"]` to `["/api/tutors"]` to properly fetch tutor data
- **Fixed reviews rendering error**: Added `Array.isArray()` check before mapping reviews to prevent runtime errors
- **Implemented favorites toggle on TutorBrowse**: Added heart button functionality with React Query mutations for add/remove favorites
- **Implemented favorites toggle on TutorProfile**: Added heart button with visual feedback (filled red when favorited)
- **Favorites sync**: Cache invalidation ensures favorite state syncs across browse and profile pages
- **Dashboard Favorite Tutors Section**: 
  - Fixed StudentDashboard queryKeys to use proper format (`["/api/tutors"]`, `["/api/sessions"]`)
  - Favorite tutors now display in dashboard sidebar showing up to 3 favorited tutors
  - Shows tutor profile picture, name, primary subject, and chat button
  - Real-time sync with favorites added/removed from browse or profile pages

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React.js with TypeScript**: Component-based architecture using functional components with hooks
- **Wouter**: Lightweight routing solution for client-side navigation
- **Tailwind CSS + Shadcn/UI**: Utility-first styling with pre-built component library for consistent design
- **React Query (@tanstack/react-query)**: Server state management with caching, synchronization, and optimistic updates
- **React Hook Form + Zod**: Form handling with runtime validation and type safety
- **Vite**: Fast build tool and development server with hot module replacement

## Backend Architecture
- **Express.js**: RESTful API server with middleware-based request processing
- **Drizzle ORM**: Type-safe database operations with PostgreSQL dialect
- **Session-based Authentication**: Replit Auth integration with OpenID Connect and Passport.js
- **File Upload System**: Uppy integration with cloud storage capabilities
- **Role-based Access Control**: Three-tier user system (student, tutor, admin) with route protection

## Database Design
- **PostgreSQL with Drizzle Schema**: Relational database with type-safe schema definitions
- **Core Entities**: Users, subjects, tutor profiles, sessions, reviews, messages, and file uploads
- **Relationship Management**: Foreign key constraints linking tutors to subjects, sessions to participants
- **Session Storage**: Express sessions stored in PostgreSQL for persistent authentication

## Authentication & Authorization
- **Replit Auth**: OpenID Connect provider with OAuth2 flows
- **Passport.js Integration**: Strategy-based authentication middleware
- **Role-based Access**: User roles determine available features and API endpoints
- **Protected Routes**: Frontend and backend route guards based on authentication status

## Real-time Features
- **Polling-based Messaging**: Chat system using React Query's refetch intervals
- **Session Management**: Live session status updates and scheduling
- **Notification System**: Toast notifications for user feedback and error handling

## State Management
- **React Query**: Server state caching and synchronization
- **Local Component State**: React useState for UI-specific state
- **Form State**: React Hook Form for complex form interactions
- **Authentication State**: Custom useAuth hook wrapping user session data

# External Dependencies

## Core Framework Dependencies
- **@neondatabase/serverless**: PostgreSQL connection driver for serverless environments
- **@radix-ui/***: Headless UI components for accessibility and customization
- **@tanstack/react-query**: Server state management and data fetching
- **wouter**: Lightweight React routing library

## Development & Build Tools
- **Vite**: Frontend build tool and development server
- **TypeScript**: Static type checking and enhanced developer experience
- **Drizzle Kit**: Database schema management and migration tools
- **ESBuild**: Fast JavaScript bundler for production builds

## UI & Styling
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/UI**: Pre-built component library built on Radix UI
- **Lucide React**: Icon library for consistent iconography
- **Class Variance Authority**: Utility for creating variant-based component APIs

## File Management
- **Uppy**: File upload solution with dashboard interface
- **Google Cloud Storage**: Cloud storage backend for file uploads
- **@uppy/aws-s3**: S3-compatible storage adapter

## Authentication & Session Management
- **Passport.js**: Authentication middleware for Express
- **OpenID Client**: OAuth2/OpenID Connect client implementation
- **Express Session**: Session management middleware
- **Connect PG Simple**: PostgreSQL session store

## Form Handling & Validation
- **React Hook Form**: Performant form library with minimal re-renders
- **@hookform/resolvers**: Integration with validation libraries
- **Zod**: TypeScript-first schema validation

## Database & ORM
- **Drizzle ORM**: Type-safe database toolkit
- **pg**: PostgreSQL client library
- **ws**: WebSocket library for database connections