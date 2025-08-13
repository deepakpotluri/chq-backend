// seedInstitutions.js
// Script to seed institution data into MongoDB

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');

// Load environment variables
dotenv.config();

// Sample institution data
const institutionsData = [
  {
    name: "sinIAS",
    email: "sinias123@gmail.com",
    password: "12345678", // Will be hashed
    role: "institution",
    institutionProfile: {
      institutionName: "sinIAS",
      institutionType: "coaching_institute",
      owner: {
        name: "sinIAS Academy",
        email: "sinias1234@gmail.com"
      },
      contactPerson: {
        name: "sinIAS",
        designation: "Academic Coordinator",
        phone: "9999999999",
        email: "sinias12345@gmail.com"
      },
      address: {
        street: "AshokNagar",
        city: "Hyderabad",
        state: "Telangana",
        country: "India",
        zipCode: "500020",
        fullAddress: " Ashok Nagar X Roads, Near Union Bank of India"
      },
      googleMapsLink: "https://maps.google.com/?q=28.6139,77.2090",
      description: "Premier coaching institute for UPSC civil services examination with 20+ years of excellence",
      establishedYear: 2000
    },
    isVerified: true,
    isActive: true,
    verificationStatus: "verified",
    isEmailVerified: true
  },
  {
    name: "AKS-IAS",
    email: "aksias123@gmail.com",
    password: "12345678",
    role: "institution",
    institutionProfile: {
      institutionName: "AKS-IAS",
      institutionType: "coaching_institute",
      owner: {
        name: "aksias",
        email: "aksias1234@gmail.com"
      },
      contactPerson: {
        name: "aksias1",
        designation: "Center Manager",
        phone: "9999999999",
        email: "aksias12345@gmail.com"
      },
      address: {
        street: "AshokNagar",
        city: "Hyderabad",
        state: "Telangana",
        country: "India",
        zipCode: "500020",
        fullAddress: "Beside Sub Registrar Office Main Road,Near Eshwar Lakshmi Hospital, Ashoknagar Cross Roads"
      },
      googleMapsLink: "https://maps.google.com/?q=17.4375,78.4482",
      description: "Specialized in prelims and mains preparation with experienced faculty",
      establishedYear: 2010
    },
    isVerified: true,
    isActive: true,
    verificationStatus: "verified",
    isEmailVerified: true
  },
  {
    name: "KP-IAS",
    email: "kpias123@gmail.com",
    password: "12345678",
    role: "institution",
    institutionProfile: {
      institutionName: "KP-IAS",
      institutionType: "coaching_institute",
      owner: {
        name: "KrishnaPradeep",
        email: "kpias1234@gmail.com"
      },
      contactPerson: {
        name: "kpias",
        designation: "Student Coordinator",
        phone: "9999999999",
        email: "kpias12345@gamil.com"
      },
      address: {
        street: "RTC X Rd",
        city: "Hyderabad",
        state: "Telangana",
        country: "India",
        zipCode: "500020",
        fullAddress: "Bawarchi building, Door no 1, 7-1069, RTC X Rd, beside sandhya theater, opposite bawarchi restaurant"
      },
      googleMapsLink: "https://maps.google.com/?q=22.5726,88.3639",
      description: "Online focused academy with live classes and recorded lectures",
      establishedYear: 2015
    },
    isVerified: true,
    isActive: true,
    verificationStatus: "verified",
    isEmailVerified: true
  },
  {
    name: "Analog IAS Academy",
    email: "analohiasacademy123@gmail.com",
    password: "12345678",
    role: "institution",
    institutionProfile: {
      institutionName: "Analog IAS Academy",
      institutionType: "coaching_institute",
      owner: {
        name: "AnalogIAS",
        email: "analogiasacademy1234@gmail.com"
      },
      contactPerson: {
        name: "analogias",
        designation: "Operations Manager",
        phone: "9999999999",
        email: "analogiasacademy12345@gmail.com"
      },
      address: {
        street: "Ashok Nagar X roads ",
        city: "Hyderabad",
        state: "Telangana",
        country: "India",
        zipCode: "500020",
        fullAddress: "2nd Floor, Kamala Towers, 1-10-209/1, above Punjab National Bank, Ashok Nagar X Raids, Ashok Nagar, Hyderabad"
      },
      googleMapsLink: "https://maps.google.com/?q=13.0827,80.2707",
      description: "Comprehensive coaching for all stages of civil services examination",
      establishedYear: 2012
    },
    isVerified: true,
    isActive: true,
    verificationStatus: "verified",
    isEmailVerified: true
  },
  {
    name: "Brain Tree IAS Academy",
    email: "braintreeiasacademy123@gmail.com",
    password: "12345678",
    role: "institution",
    institutionProfile: {
      institutionName: "Brain Tree IAS Academy",
      institutionType: "training_center",
      owner: {
        name: "BrainTreeAcademy",
        email: "braintreeiasacademy1234@gmail.com"
      },
      contactPerson: {
        name: "braintreeacademy",
        designation: "Academic Director",
        phone: "9999999999",
        email: "braintreeiasacademy12345@gmail.com"
      },
      address: {
        street: "Himayat Nagar Main Road",
        city: "Hyderabad",
        state: "Telangana",
        country: "India",
        zipCode: "500020",
        fullAddress: " Himayat Nagar Main Road, Adjacent to Bajaj Electronics ,Himayatnagar Hyderabad"
      },
      googleMapsLink: "https://maps.google.com/?q=12.9716,77.5946",
      description: "Modern training center with smart classrooms and digital resources",
      establishedYear: 2018
    },
    isVerified: true,
    isActive: true,
    verificationStatus: "verified",
    isEmailVerified: true
  }
];

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
}

// Seed institutions
async function seedInstitutions() {
  try {
    console.log('Starting institution seeding...');
    
    // Optional: Clear existing test institutions (be careful with this!)
    // await User.deleteMany({ 
    //   role: 'institution', 
    //   email: { $in: institutionsData.map(i => i.email) } 
    // });
    
    const createdInstitutions = [];
    
    for (const institutionData of institutionsData) {
      // Check if institution already exists
      const existingInstitution = await User.findOne({ email: institutionData.email });
      
      if (existingInstitution) {
        console.log(`Institution ${institutionData.email} already exists, skipping...`);
        continue;
      }
      
      // Create the institution
      const institution = await User.create(institutionData);
      createdInstitutions.push(institution);
      console.log(`Created institution: ${institution.institutionProfile.institutionName}`);
    }
    
    console.log(`\n✅ Successfully created ${createdInstitutions.length} institutions`);
    console.log('\nCreated institutions:');
    createdInstitutions.forEach(inst => {
      console.log(`- ${inst.institutionProfile.institutionName} (${inst.email})`);
    });
    
  } catch (error) {
    console.error('Error seeding institutions:', error);
  }
}

// Main function
async function main() {
  await connectDB();
  await seedInstitutions();
  
  // Close connection
  await mongoose.connection.close();
  console.log('\nDatabase connection closed.');
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { institutionsData, seedInstitutions };