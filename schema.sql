
-- Users table (tourists, guides, admins)
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    user_type ENUM('tourist', 'guide', 'admin') DEFAULT 'tourist',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Guides table (extended profile for guide users)
CREATE TABLE IF NOT EXISTS guides (
    guide_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    bio TEXT,
    languages_spoken VARCHAR(255),
    years_experience INT,
    specialization VARCHAR(255),
    rating DECIMAL(2,1) DEFAULT 5.0,
    total_reviews INT DEFAULT 0,
    commission_rate DECIMAL(4,2) DEFAULT 15.00,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Tourism experiences/activities
CREATE TABLE experiences (
    experience_id INT AUTO_INCREMENT PRIMARY KEY,
    guide_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255) NOT NULL,
    duration_hours INT,
    max_participants INT,
    price_per_person DECIMAL(10,2) NOT NULL,
    category ENUM('adventure', 'cultural', 'food', 'nature', 'historical', 'wellness') NOT NULL,
    difficulty_level ENUM('easy', 'moderate', 'challenging') DEFAULT 'easy',
    meeting_point VARCHAR(255),
    included_items TEXT,
    requirements TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guide_id) REFERENCES guides(guide_id) ON DELETE CASCADE
);

-- Seasonal pricing and demand tracking
CREATE TABLE seasonal_pricing (
    pricing_id INT AUTO_INCREMENT PRIMARY KEY,
    experience_id INT NOT NULL,
    season_name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    price_multiplier DECIMAL(3,2) DEFAULT 1.00,
    is_peak_season BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (experience_id) REFERENCES experiences(experience_id) ON DELETE CASCADE
);

-- Bookings made by tourists
CREATE TABLE bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    experience_id INT NOT NULL,
    tourist_id INT NOT NULL,
    booking_date DATE NOT NULL,
    scheduled_date DATE NOT NULL,
    num_participants INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'confirmed', 'completed', 'cancelled', 'refunded') DEFAULT 'pending',
    special_requests TEXT,
    payment_status ENUM('pending', 'paid', 'refunded', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experience_id) REFERENCES experiences(experience_id),
    FOREIGN KEY (tourist_id) REFERENCES users(user_id)
);

-- Revenue distribution between guides and platform
CREATE TABLE revenue_distribution (
    distribution_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT UNIQUE NOT NULL,
    guide_amount DECIMAL(10,2) NOT NULL,
    platform_amount DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    distribution_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_status ENUM('pending', 'processed', 'paid') DEFAULT 'pending',
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
);

-- Reviews and feedback
CREATE TABLE reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT UNIQUE NOT NULL,
    tourist_id INT NOT NULL,
    guide_id INT NOT NULL,
    experience_id INT NOT NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    guide_response TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    FOREIGN KEY (tourist_id) REFERENCES users(user_id),
    FOREIGN KEY (guide_id) REFERENCES guides(guide_id),
    FOREIGN KEY (experience_id) REFERENCES experiences(experience_id)
);

-- Demand analytics for seasonal trends
CREATE TABLE demand_analytics (
    analytics_id INT AUTO_INCREMENT PRIMARY KEY,
    experience_id INT,
    date_recorded DATE NOT NULL,
    views_count INT DEFAULT 0,
    bookings_count INT DEFAULT 0,
    cancellation_count INT DEFAULT 0,
    revenue_generated DECIMAL(12,2) DEFAULT 0.00,
    FOREIGN KEY (experience_id) REFERENCES experiences(experience_id)
);

-- Notifications for users
CREATE TABLE notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('booking', 'review', 'payment', 'system') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX idx_bookings_tourist ON bookings(tourist_id);
CREATE INDEX idx_bookings_experience ON bookings(experience_id);
CREATE INDEX idx_bookings_date ON bookings(scheduled_date);
CREATE INDEX idx_experiences_guide ON experiences(guide_id);
CREATE INDEX idx_experiences_location ON experiences(location);
CREATE INDEX idx_reviews_guide ON reviews(guide_id);
