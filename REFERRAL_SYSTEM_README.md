# Referral System Implementation

This document describes the implementation of the referral system for the ChooseYourCollege choice filling feature.

## Overview

The referral system allows users to earn free choice filling trials by referring friends. Users can refer 3 or 5 friends to earn additional trials with more choices.

## Features

### Freemium Plan
- **1 Free Trial**: 20 choices maximum
- **One-time use**: Can only be used once per email
- **Restriction**: After using the free trial, users must either refer friends or purchase premium

### Referral Rewards
- **3 Referrals**: Earn 3 free trials with 75 choices each
- **5 Referrals**: Earn 5 free trials with 200 choices each
- **Requirements**: Referred users must complete the entire choice filling process

### Premium Plans
- **₹199 Plan**: 75 choices per session, unlimited access for 30 days
- **₹299 Plan**: 200 choices per session, unlimited access for 30 days

## Database Tables

### 1. choice_filling_usage
Tracks user usage and plan status:
- `user_id`: Reference to auth.users
- `email`: User's email
- `usage_count`: Number of times used
- `max_choices`: Maximum choices allowed
- `plan_type`: Current plan (freemium, premium_199, premium_299, referral_75, referral_200)
- `referral_trials_earned`: Number of trials earned through referrals
- `referral_trials_used`: Number of trials used

### 2. user_referrals
Tracks referral relationships:
- `referrer_id`: User who made the referral
- `referrer_email`: Referrer's email
- `referred_email`: Referred user's email
- `referred_phone`: Referred user's phone
- `status`: pending, completed, expired
- `completed_at`: When the referral was completed

### 3. choice_filling_logs
Detailed usage tracking:
- `user_id`: Reference to auth.users
- `email`: User's email
- `session_id`: Unique session identifier
- `choices_generated`: Number of choices generated
- `pdf_downloaded`: Whether PDF was downloaded

### 4. profiles (Updated)
Added referral_code field:
- `referral_code`: Unique referral code for the user

## API Endpoints

### 1. `/api/check-usage`
- **Method**: POST
- **Purpose**: Check user's current usage and restrictions
- **Body**: `{ userId, email }`
- **Response**: Usage data and whether user can access choice filling

### 2. `/api/track-usage`
- **Method**: POST
- **Purpose**: Track when user completes choice filling
- **Body**: `{ userId, email, sessionId, choicesGenerated, pdfDownloaded }`
- **Response**: Updated usage statistics

### 3. `/api/get-user-referrals`
- **Method**: POST
- **Purpose**: Get user's referral information
- **Body**: `{ userId }`
- **Response**: List of referrals and statistics

### 4. `/api/record-referral`
- **Method**: POST
- **Purpose**: Record a new referral when user signs up
- **Body**: `{ referrerCode, referredUserId, referredEmail, referredPhone }`
- **Response**: Confirmation of referral creation

### 5. `/api/complete-referral`
- **Method**: POST
- **Purpose**: Mark referral as completed when referred user finishes choice filling
- **Body**: `{ referredUserId, referredEmail }`
- **Response**: Updated referral status

### 6. `/api/create-usage-tables`
- **Method**: POST
- **Purpose**: Create database tables (admin only)
- **Response**: Confirmation of table creation

## User Interface

### Header Integration
- Added "Track Referrals" button in the header
- Shows referral dashboard with statistics
- Displays referred users and their status

### Usage Modal
- Appears when user has used their free trial
- Shows current usage status
- Displays referral and premium options
- Direct link to referral tracking

### Referral Dashboard
- Shows total, pending, and completed referrals
- Displays available trials
- Shows current plan benefits
- Progress indicators for referral goals

## Setup Instructions

1. **Create Database Tables**:
   - Visit `/admin/setup-database`
   - Click "Setup Database Tables"
   - Verify all tables are created successfully

2. **Test the System**:
   - Create a new user account
   - Complete choice filling once (uses free trial)
   - Try to access choice filling again (should show usage modal)
   - Test referral tracking functionality

3. **Monitor Usage**:
   - Check `/admin/setup-database` for table status
   - Monitor referral completion rates
   - Track premium plan conversions

## Usage Flow

1. **New User**:
   - Signs up and gets 1 free trial (20 choices)
   - Completes choice filling
   - Usage is tracked

2. **After Free Trial**:
   - User tries to access choice filling again
   - Usage modal appears with options
   - User can refer friends or purchase premium

3. **Referral Process**:
   - User shares referral link
   - Friend signs up using referral code
   - Friend completes choice filling
   - Referral is marked as completed
   - Original user earns trial(s)

4. **Premium Plans**:
   - User can purchase ₹199 or ₹299 plan
   - Gets unlimited access with more choices
   - No referral requirements

## Security Considerations

- All API endpoints validate user authentication
- Referral codes are unique and tied to user accounts
- Usage tracking prevents abuse
- Premium plans require payment verification

## Future Enhancements

- Payment gateway integration for premium plans
- Email notifications for referral completions
- Analytics dashboard for referral performance
- Social sharing integration
- Referral leaderboards
- Automated referral expiration 