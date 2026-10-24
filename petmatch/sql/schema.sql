CREATE DATABASE IF NOT EXISTS petmatch CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE petmatch;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  type ENUM('dog','cat') NOT NULL,
  breed VARCHAR(120) DEFAULT '',
  age VARCHAR(80) DEFAULT '',
  gender ENUM('male','female','unknown') NOT NULL DEFAULT 'unknown',
  size ENUM('small','medium','large') NOT NULL DEFAULT 'medium',
  description TEXT,
  health_status VARCHAR(255) DEFAULT '',
  area VARCHAR(160) DEFAULT '',
  address VARCHAR(255) DEFAULT '',
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  status ENUM('available','pending','adopted') NOT NULL DEFAULT 'available',
  featured TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pets_status_type (status, type),
  INDEX idx_pets_location (latitude, longitude),
  INDEX idx_pets_featured (featured)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pet_images (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pet_id BIGINT UNSIGNED NOT NULL,
  image_path VARCHAR(500) NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pet_images_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
  INDEX idx_pet_images_pet_primary (pet_id, is_primary)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS favorites (
  user_id BIGINT UNSIGNED NOT NULL,
  pet_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, pet_id),
  CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_favorites_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS adoption_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  pet_id BIGINT UNSIGNED NOT NULL,
  message TEXT,
  phone VARCHAR(40) NOT NULL,
  address TEXT NOT NULL,
  status ENUM('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_adoptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_adoptions_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
  UNIQUE KEY uq_adoption_user_pet (user_id, pet_id),
  INDEX idx_adoptions_status (status)
) ENGINE=InnoDB;

-- 1. เพิ่มข้อมูลผู้ใช้ (รหัสผ่านคือ 12345678)
INSERT INTO users (name, email, password_hash, role) VALUES
('Admin User', 'admin@petmatch.com', '$2a$12$TOzxKtUfqZLMyYJhDxkrueyo267v.qSoblNDIllNT31kqiKpXFlna', 'admin'),
('Somchai Dee', 'somchai@example.com', '$2a$12$TOzxKtUfqZLMyYJhDxkrueyo267v.qSoblNDIllNT31kqiKpXFlna', 'user'),
('Manee Jaidee', 'manee@example.com', '$2a$12$TOzxKtUfqZLMyYJhDxkrueyo267v.qSoblNDIllNT31kqiKpXFlna', 'user');

-- 2. เพิ่มข้อมูลสัตว์เลี้ยง
INSERT INTO pets (name, type, breed, age, gender, size, description, health_status, area, address, latitude, longitude, status, featured) VALUES
('Buddy', 'dog', 'Golden Retriever', '2 ปี', 'male', 'large', 'ใจดี ร่าเริง เข้ากับเด็กได้ง่าย', 'ฉีดวัคซีนครบแล้ว แข็งแรง', 'กรุงเทพมหานคร', '123 ถ.สุขุมวิท เขตวัฒนา', 13.736717, 100.582814, 'available', 1),
('Luna', 'cat', 'Scottish Fold', '10 เดือน', 'female', 'small', 'ขี้อ้อน ชอบนอนเล่น', 'ทำหมันและฉีดวัคซีนแล้ว', 'เชียงใหม่', '456 นิมมานเหมินท์ อ.เมือง', 18.795221, 98.962057, 'available', 0),
('Max', 'dog', 'Thai Bangkaew', '1.5 ปี', 'male', 'medium', 'เฝ้าบ้านเก่ง รักเจ้าของ', 'ฉีดวัคซีนพิษสุนัขบ้าแล้ว', 'ขอนแก่น', '789 ม.ขอนแก่น', 16.441935, 102.835992, 'pending', 0);

-- 3. เพิ่มข้อมูลรูปภาพสัตว์เลี้ยง
INSERT INTO pet_images (pet_id, image_path, is_primary) VALUES
(1, '/uploads/pets/buddy-1.jpg', 1),
(1, '/uploads/pets/buddy-2.jpg', 0),
(2, '/uploads/pets/luna-1.jpg', 1),
(3, '/uploads/pets/max-1.jpg', 1);

-- 4. เพิ่มข้อมูลรายการโปรด
INSERT INTO favorites (user_id, pet_id) VALUES
(2, 1),
(2, 2),
(3, 1);

-- 5. เพิ่มข้อมูลคำร้องขอรับเลี้ยง
INSERT INTO adoption_requests (user_id, pet_id, message, phone, address, status) VALUES
(2, 1, 'ที่บ้านมีพื้นที่กว้างขวาง และเคยเลี้ยงสุนัขพันธุ์นี้มาก่อนครับ อยากรับน้องไปดูแล', '081-234-5678', '123 ถ.สุขุมวิท เขตวัฒนา กรุงเทพฯ 10110', 'pending'),
(3, 3, 'สนใจรับน้องไปเฝ้าสวนที่ขอนแก่นค่ะ', '089-876-5432', '789 ม.ขอนแก่น อ.เมือง จ.ขอนแก่น 40000', 'approved');