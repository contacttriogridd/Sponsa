/*
# Seed Demo Data

1. Purpose
   Insert realistic demo sponsors, family members, special occasions, donations,
   sponsorship requests, interactions, and notifications for testing the full workflow.

2. Data
   - 8 sponsors with varied profiles (some with upcoming birthdays/anniversaries)
   - Family members for several sponsors
   - Special occasions (birthdays auto-generated from DOB, anniversaries)
   - 5 donations with food sponsorship details
   - 3 sponsorship requests in various statuses
   - 2 interactions logged
   - 2 follow-up tasks

3. Notes
   - Uses ON CONFLICT DO NOTHING to be idempotent.
   - Dates are relative to September 2026 so reminders appear "upcoming".
   - Raj Kumar's birthday is Sept 10 — the primary demo scenario.
*/

-- Sponsors
INSERT INTO sponsors (id, sponsor_id, full_name, preferred_name, dob, phone, whatsapp, email, address, city, district, state, occupation, company, communication_preference, whatsapp_consent, notes, status, total_donations, people_helped) VALUES
('a0000000-0000-0000-0000-000000000001', 'SP-001', 'Raj Kumar', 'Raj', '1985-09-10', '+919876543210', '+919876543210', 'raj.kumar@email.com', '12 Gandhi Road', 'Madurai', 'Madurai', 'Tamil Nadu', 'Businessman', 'Kumar Enterprises', 'whatsapp', true, 'Long-time supporter. Prefers lunch sponsorships.', 'active', 45000, 300),
('a0000000-0000-0000-0000-000000000002', 'SP-002', 'Priya Sharma', 'Priya', '1990-01-15', '+919876543211', '+919876543211', 'priya.sharma@email.com', '45 Lake View', 'Chennai', 'Chennai', 'Tamil Nadu', 'Doctor', 'City Hospital', 'whatsapp', true, 'Sponsors for birthday and anniversary.', 'active', 25000, 180),
('a0000000-0000-0000-0000-000000000003', 'SP-003', 'Mohammed Ali', 'Ali', '1978-09-12', '+919876543212', '+919876543212', 'mohammed.ali@email.com', '78 MG Road', 'Coimbatore', 'Coimbatore', 'Tamil Nadu', 'Engineer', 'Tech Solutions', 'whatsapp', true, 'Interested in monthly sponsorships.', 'active', 60000, 450),
('a0000000-0000-0000-0000-000000000004', 'SP-004', 'Lakshmi Devi', 'Lakshmi', '1992-09-09', '+919876543213', '+919876543213', 'lakshmi.devi@email.com', '23 Temple Street', 'Trichy', 'Trichy', 'Tamil Nadu', 'Teacher', 'Government School', 'call', false, 'Prefers phone calls over WhatsApp.', 'active', 15000, 100),
('a0000000-0000-0000-0000-000000000005', 'SP-005', 'Suresh Patel', 'Suresh', '1970-09-15', '+919876543214', '+919876543214', 'suresh.patel@email.com', '56 Market Road', 'Salem', 'Salem', 'Tamil Nadu', 'Shop Owner', 'Patel Stores', 'whatsapp', true, 'Annual birthday sponsorship.', 'active', 80000, 600),
('a0000000-0000-0000-0000-000000000006', 'SP-006', 'Anitha Reddy', 'Anitha', '1988-11-20', '+919876543215', '+919876543215', 'anitha.reddy@email.com', '89 Park Avenue', 'Vellore', 'Vellore', 'Tamil Nadu', 'Lawyer', 'Reddy & Associates', 'email', true, 'Prefers email communication.', 'active', 30000, 200),
('a0000000-0000-0000-0000-000000000007', 'SP-007', 'Karthik Raja', 'Karthik', '1995-09-11', '+919876543216', '+919876543216', 'karthik.raja@email.com', '34 College Road', 'Erode', 'Erode', 'Tamil Nadu', 'Software Engineer', 'IT Park', 'whatsapp', true, 'New sponsor. First birthday with us.', 'active', 0, 0),
('a0000000-0000-0000-0000-000000000008', 'SP-008', 'Deepika Nair', 'Deepika', '1983-03-08', '+919876543217', '+919876543217', 'deepika.nair@email.com', '67 Beach Road', 'Kanyakumari', 'Kanyakumari', 'Tamil Nadu', 'Architect', 'Nair Designs', 'whatsapp', true, 'Sponsors groceries regularly.', 'archived', 55000, 400)
ON CONFLICT (id) DO NOTHING;

-- Family members
INSERT INTO family_members (id, sponsor_id, full_name, relationship, dob, phone, whatsapp, notes) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Priya Kumar', 'Wife', '1990-01-15', '+919876543210', '+919876543210', 'Anniversary: Feb 20'),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Arjun Kumar', 'Son', '2015-12-05', NULL, NULL, 'School going'),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Rahul Sharma', 'Husband', '1988-07-22', '+919876543211', '+919876543211', NULL),
('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', 'Fatima Ali', 'Wife', '1982-06-18', '+919876543212', '+919876543212', NULL),
('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', 'Meena Patel', 'Wife', '1975-04-25', '+919876543214', '+919876543214', NULL)
ON CONFLICT (id) DO NOTHING;

-- Special occasions: Sponsor birthdays
INSERT INTO special_occasions (id, sponsor_id, family_member_id, person_name, relationship, occasion_type, occasion_date, recurring_yearly, is_auto_generated, active) VALUES
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', NULL, 'Raj Kumar', 'Self', 'Birthday', '1985-09-10', true, true, true),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', NULL, 'Priya Sharma', 'Self', 'Birthday', '1990-01-15', true, true, true),
('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', NULL, 'Mohammed Ali', 'Self', 'Birthday', '1978-09-12', true, true, true),
('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', NULL, 'Lakshmi Devi', 'Self', 'Birthday', '1992-09-09', true, true, true),
('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', NULL, 'Suresh Patel', 'Self', 'Birthday', '1970-09-15', true, true, true),
('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', NULL, 'Anitha Reddy', 'Self', 'Birthday', '1988-11-20', true, true, true),
('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', NULL, 'Karthik Raja', 'Self', 'Birthday', '1995-09-11', true, true, true),
('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000008', NULL, 'Deepika Nair', 'Self', 'Birthday', '1983-03-08', true, true, true)
ON CONFLICT (id) DO NOTHING;

-- Family member birthdays
INSERT INTO special_occasions (id, sponsor_id, family_member_id, person_name, relationship, occasion_type, occasion_date, recurring_yearly, is_auto_generated, active) VALUES
('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Priya Kumar', 'Wife', 'Birthday', '1990-01-15', true, true, true),
('c0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'Arjun Kumar', 'Son', 'Birthday', '2015-12-05', true, true, true),
('c0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'Rahul Sharma', 'Husband', 'Birthday', '1988-07-22', true, true, true),
('c0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004', 'Fatima Ali', 'Wife', 'Birthday', '1982-06-18', true, true, true),
('c0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005', 'Meena Patel', 'Wife', 'Birthday', '1975-04-25', true, true, true)
ON CONFLICT (id) DO NOTHING;

-- Wedding anniversaries
INSERT INTO special_occasions (id, sponsor_id, family_member_id, person_name, relationship, occasion_type, occasion_date, recurring_yearly, is_auto_generated, active) VALUES
('c0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', NULL, 'Raj & Priya Kumar', 'Self', 'Wedding Anniversary', '2010-02-20', true, false, true),
('c0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000002', NULL, 'Priya & Rahul Sharma', 'Self', 'Wedding Anniversary', '2015-11-10', true, false, true),
('c0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000003', NULL, 'Mohammed & Fatima Ali', 'Self', 'Wedding Anniversary', '2005-09-14', true, false, true),
('c0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000005', NULL, 'Suresh & Meena Patel', 'Self', 'Wedding Anniversary', '1998-12-01', true, false, true)
ON CONFLICT (id) DO NOTHING;

-- Donations
INSERT INTO donations (id, donation_id, sponsor_id, occasion_id, occasion_name, donation_date, type, amount, food_quantity, people_helped, location, food_type, food_description, payment_method, transaction_id, receipt_number, notes, status) VALUES
('d0000000-0000-0000-0000-000000000001', 'DON-001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Birthday', '2025-09-10', 'Food Sponsorship', 15000, '100 meals', 100, 'Madurai', 'Lunch', 'South Indian thali meal for 100 people', 'Bank Transfer', 'TXN001', 'RCPT001', 'Birthday sponsorship - lunch for 100 people', 'completed'),
('d0000000-0000-0000-0000-000000000002', 'DON-002', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'Birthday', '2025-09-12', 'Food Sponsorship', 20000, '150 meals', 150, 'Coimbatore', 'Dinner', 'Full dinner meal for 150 people', 'UPI', 'TXN002', 'RCPT002', 'Birthday sponsorship - dinner for 150 people', 'completed'),
('d0000000-0000-0000-0000-000000000003', 'DON-003', 'a0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000005', 'Birthday', '2025-09-15', 'Food Sponsorship', 25000, '200 meals', 200, 'Salem', 'Lunch', 'Special lunch for 200 people', 'Cash', 'TXN003', 'RCPT003', 'Annual birthday sponsorship', 'completed'),
('d0000000-0000-0000-0000-000000000004', 'DON-004', 'a0000000-0000-0000-0000-000000000002', NULL, 'General', '2025-06-01', 'Donation', 10000, 'Grocery kits', 80, 'Chennai', 'Groceries', '50 grocery kits for families', 'Bank Transfer', 'TXN004', 'RCPT004', 'Monthly grocery donation', 'completed'),
('d0000000-0000-0000-0000-000000000005', 'DON-005', 'a0000000-0000-0000-0000-000000000008', NULL, 'General', '2025-03-15', 'Food Sponsorship', 15000, '100 meals', 100, 'Kanyakumari', 'Breakfast', 'Breakfast for 100 people', 'UPI', 'TXN005', 'RCPT005', 'Regular breakfast sponsorship', 'completed')
ON CONFLICT (id) DO NOTHING;

-- Sponsorship requests
INSERT INTO sponsorship_requests (id, sponsor_id, occasion_id, occasion_name, special_date, requested_amount, food_type, people_count, status, notes) VALUES
('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000006', 'Birthday', '2026-11-20', 12000, 'Lunch', 80, 'pending', 'Waiting for sponsor response'),
('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'Birthday', '2026-09-12', 20000, 'Dinner', 150, 'confirmed', 'Sponsor confirmed dinner for 150 people'),
('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000005', 'Birthday', '2026-09-15', 25000, 'Lunch', 200, 'contacted', 'Contacted, awaiting confirmation')
ON CONFLICT (id) DO NOTHING;

-- Interactions
INSERT INTO interactions (id, sponsor_id, type, summary, details, interaction_date) VALUES
('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'call', 'Called regarding birthday sponsorship', 'Raj Kumar agreed to sponsor lunch for 100 people on his birthday.', '2025-09-01'),
('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'whatsapp', 'WhatsApp message sent', 'Sent sponsorship request via WhatsApp for upcoming birthday.', '2025-08-28')
ON CONFLICT (id) DO NOTHING;

-- Tasks (follow-ups)
INSERT INTO tasks (id, sponsor_id, sponsorship_request_id, title, description, status, due_date) VALUES
('1a000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001', 'Follow up with Anitha Reddy', 'Call to confirm birthday sponsorship for Nov 20.', 'Pending', '2026-09-10'),
('1a000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000003', 'Follow up with Suresh Patel', 'Confirm lunch sponsorship details for Sept 15 birthday.', 'Contacted', '2026-09-08')
ON CONFLICT (id) DO NOTHING;

-- Notifications
INSERT INTO notifications (id, type, title, message, sponsor_id, occasion_id, is_read) VALUES
('2a000000-0000-0000-0000-000000000001', 'birthday_tomorrow', 'Birthday Tomorrow', 'Raj Kumar has a birthday tomorrow (September 10).', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', false),
('2a000000-0000-0000-0000-000000000002', 'birthday_today', 'Birthday Today', 'Lakshmi Devi has a birthday today (September 9).', 'a0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', false),
('2a000000-0000-0000-0000-000000000003', 'sponsorship_followup', 'Sponsorship Follow-up', 'Follow up with Anitha Reddy about birthday sponsorship.', 'a0000000-0000-0000-0000-000000000006', NULL, false),
('2a000000-0000-0000-0000-000000000004', 'donation_received', 'Donation Received', 'Received Rs.25,000 from Suresh Patel for birthday lunch sponsorship.', 'a0000000-0000-0000-0000-000000000005', NULL, true)
ON CONFLICT (id) DO NOTHING;