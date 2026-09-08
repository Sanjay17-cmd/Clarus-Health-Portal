// ── Seed Script — Generates bcrypt hashes and outputs SQL INSERT statements ──
// Run: node seed-hashes.js

const bcrypt = require('bcryptjs');

async function generateSeeds() {
  const users = [
    { email: 'admin@clarus.health',       password: 'admin123',   name: 'Dr. Sarah Mitchell', role: 'Admin',         dept: 'Administration', phone: '+1-555-0100' },
    { email: 'dr.chen@clarus.health',     password: 'doctor123',  name: 'Dr. James Chen',     role: 'Doctor',        dept: 'Cardiology',     phone: '+1-555-0201' },
    { email: 'lab.martinez@clarus.health', password: 'lab123',    name: 'Maria Martinez',     role: 'LabTechnician', dept: 'Pathology',      phone: '+1-555-0301' },
    { email: 'emily.wilson@email.com',     password: 'patient123', name: 'Emily Wilson',       role: 'Patient',       dept: null,             phone: '+1-555-0401' },
    { email: 'robert.taylor@email.com',   password: 'patient123', name: 'Robert Taylor',     role: 'Patient',       dept: null,             phone: '+1-555-0402' },
  ];

  console.log('-- Generated bcrypt hashes for seed data');
  console.log('-- Copy these INSERT statements into schema.sql\n');

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    const dept = u.dept ? `'${u.dept}'` : 'NULL';
    console.log(
      `INSERT INTO Users (email, password_hash, full_name, role, department, phone) VALUES\n` +
      `('${u.email}', '${hash}', '${u.name}', '${u.role}', ${dept}, '${u.phone}');\n`
    );
  }
}

generateSeeds().catch(console.error);
