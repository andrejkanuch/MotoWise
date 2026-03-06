-- Migration: Types and Extensions
-- Creates custom types and enables required extensions

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE article_difficulty AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE article_category AS ENUM ('engine', 'brakes', 'electrical', 'suspension', 'drivetrain', 'tires', 'fuel', 'general');
CREATE TYPE diagnostic_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE flag_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');
