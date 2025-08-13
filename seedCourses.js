// seedCourses.js
// Script to seed course data into MongoDB

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Course = require('./models/Course');
const User = require('./models/User');

// Load environment variables
dotenv.config();

// Sample course data based on the images
const getCoursesData = (institutionIds) => [
  {
  title: "All India Prelims 2024 Test Series-Conquer Prelims",
  description: "First time in India-Prelims 2024 All India Open Mock Test Series!\n*UPSC CSE Pattern General Studies + CSAT.\n*All India Ranking.\n*Detailed Explanation Sheet.\n*Quick Revision Material....",
  price: 15421,
  originalPrice: 15421,
  discount: 0,
  duration: "4 Month Validity",
  institution: institutionIds['AKS-IAS'], // Will be set dynamically
  courseCategory: "test-series",
  courseType: ["online"],
  courseLanguages: ["english"],
  city: "Hyderabad",
  state: "Telangana",
  address: "Ashok Nagar, Hyderabad",
  subjects: ["General Studies", "CSAT"],
  highlights: [
    "First time in India-Prelims 2024 All India Open Mock Test Series!",
    "UPSC CSE Pattern General Studies + CSAT",
    "All India Ranking",
    "Detailed Explanation Sheet",
    "Quick Revision Material",
    "23 TESTS",
    "General Studies - PAPER-I: 11 Sectional Tests + 5 Full length",
    "CSAT - PAPER-II: 02 Sectional Tests + 5 Full length",
    "Comprehensive Coverage of Syllabus",
    "Master the Art of Solving Problems",
    "Techniques to Crack Questions",
    "Questions on Static Topics Integrated with Current affairs",
    "Analyzing UPSC Previous Year Question Papers and the Trends"
  ],
  whatYouWillLearn: [],
  prerequisites: [],
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-05-01"),
  syllabusDetails: [],
  schedule: [],
  coverImage: "default-course.jpg",
  galleryImages: [],
  promotionLevel: "none",
  isFeatured: false,
  tags: ["UPSC", "Prelims", "Test Series", "2024", "All India"],
  searchKeywords: [],
  isPublished: true,
  status: "published",
  deliveryType: "recorded",
  maxStudents: 0,
  currentEnrollments: 0,
  averageRating: {
    course: 0,
    institute: 0,
    faculty: 0,
    overall: 0
  },
  totalReviews: 0,
  views: 0,
  shortlisted: 0,
  faculty: [],
  weeklySchedule: [],
  modules: [],
  enrollments: [],
  reviews: []
},

{
  title: "ESSAY Enrichment & Mentorship for UPSC CSE MAINS",
  description: "ESSAY Enrichment & Mentorship for UPSC CSE MAINS 2020!\n\n\"Quality is never an incident. It is always the result of intelligent effort.\"\nAKS IAS announces the launch of its Essay Enrichment Program for UPSC CSM – 2020. This Program aims to provide an objective evaluation of each aspirant's performance, which would lead ...",
  price: 14394,
  originalPrice: 14394,
  discount: 0,
  duration: "4 Month Validity",
  institution: institutionIds['AKS-IAS'], // Will be set dynamically
  courseCategory: "mains",
  courseType: ["online"],
  courseLanguages: ["english"],
  city: "Hyderabad",
  state: "Telangana",
  address: "Ashok Nagar, Hyderabad",
  subjects: ["Essay"],
  highlights: [
    "Essay Enrichment Program for UPSC CSE MAINS",
    "Objective evaluation of each aspirant's performance",
    "Class-Test-Evaluation-Discussion",
    "Offline Download - Learn at your convenience",
    "Available on PC - Bigger screen, better clarity"
  ],
  whatYouWillLearn: [],
  prerequisites: [],
  startDate: new Date("2025-01-01"),
  endDate: new Date("2025-05-01"),
  syllabusDetails: [],
  schedule: [],
  coverImage: "default-course.jpg",
  galleryImages: [],
  promotionLevel: "none",
  isFeatured: false,
  tags: ["UPSC", "Essay", "Mains", "Mentorship"],
  searchKeywords: [],
  isPublished: true,
  status: "published",
  deliveryType: "recorded",
  maxStudents: 0,
  currentEnrollments: 0,
  averageRating: {
    course: 0,
    institute: 0,
    faculty: 0,
    overall: 0
  },
  totalReviews: 0,
  views: 0,
  shortlisted: 0,
  faculty: [],
  weeklySchedule: [],
  modules: [],
  enrollments: [],
  reviews: []
},
{
  title: "NCERT/UPSC Initiation Course",
  description: "-Initiation Course Covers Important NCERT Texts and Related Concepts\n-Current Affairs Magazine\n-Strategy Sessions on UPSC CSE Preparation",
  price: 15421,
  originalPrice: 15421,
  discount: 0,
  duration: "2 Year Validity",
  institution: institutionIds['AKS-IAS'], // Will be set dynamically
  courseCategory: "foundation",
  courseType: ["online"],
  courseLanguages: ["english"],
  city: "Hyderabad",
  state: "Telangana",
  address: "Ashok Nagar, Hyderabad",
  subjects: ["NCERT"],
  highlights: [
    "Initiation Course Covers Important NCERT Texts and Related Concepts",
    "Current Affairs Magazine",
    "Strategy Sessions on UPSC CSE Preparation",
    "Offline Download - Learn at your convenience",
    "50+ Learning Material",
    "76 Video lectures"
  ],
  whatYouWillLearn: [],
  prerequisites: [],
  startDate: new Date("2025-01-01"),
  endDate: new Date("2027-01-01"),
  syllabusDetails: [],
  schedule: [],
  coverImage: "default-course.jpg",
  galleryImages: [],
  promotionLevel: "none",
  isFeatured: false,
  tags: ["NCERT", "UPSC", "Initiation", "Foundation"],
  searchKeywords: [],
  isPublished: true,
  status: "published",
  deliveryType: "recorded",
  maxStudents: 0,
  currentEnrollments: 0,
  averageRating: {
    course: 0,
    institute: 0,
    faculty: 0,
    overall: 0
  },
  totalReviews: 0,
  views: 0,
  shortlisted: 0,
  faculty: [],
  weeklySchedule: [],
  modules: [],
  enrollments: [],
  reviews: []
},
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

// Get institution IDs
async function getInstitutionIds() {
  const institutionIds = {};
  const institutionNames = ['sinIAS', 'AKS-IAS', 'KP-IAS', 'Analog IAS Academy', 'Brain Tree IAS Academy'];
  
  for (const name of institutionNames) {
    const institution = await User.findOne({ 
      'institutionProfile.institutionName': name,
      role: 'institution'
    });
    
    if (institution) {
      institutionIds[name] = institution._id;
      console.log(`Found institution: ${name} (${institution._id})`);
    } else {
      console.warn(`Institution not found: ${name}`);
    }
  }
  
  return institutionIds;
}

// Seed courses
async function seedCourses() {
  try {
    console.log('Starting course seeding...');
    
    // Get institution IDs
    const institutionIds = await getInstitutionIds();
    
    // Check if we have all required institutions
    if (Object.keys(institutionIds).length === 0) {
      console.error('No institutions found. Please run seedInstitutions.js first.');
      return;
    }
    
    // Get courses data with institution IDs
    const coursesData = getCoursesData(institutionIds);
    
    // Optional: Clear existing test courses (be careful with this!)
    // await Course.deleteMany({ 
    //   title: { $in: coursesData.map(c => c.title) } 
    // });
    
    const createdCourses = [];
    
    for (const courseData of coursesData) {
      // Skip if institution not found
      if (!courseData.institution) {
        console.log(`Skipping course "${courseData.title}" - institution not found`);
        continue;
      }
      
      // Check if course already exists
      const existingCourse = await Course.findOne({ 
        title: courseData.title,
        institution: courseData.institution
      });
      
      if (existingCourse) {
        console.log(`Course "${courseData.title}" already exists, skipping...`);
        continue;
      }
      
      // Add admin action
      courseData.adminAction = {
        action: "published",
        reason: "Initial seeding",
        actionBy: institutionIds['sinIAS'], // Using first institution as admin
        actionAt: new Date()
      };
      
      // Add timestamps
      courseData.createdAt = new Date();
      courseData.updatedAt = new Date();
      
      // Create the course
      const course = await Course.create(courseData);
      createdCourses.push(course);
      console.log(`Created course: ${course.title}`);
    }
    
    console.log(`\n✅ Successfully created ${createdCourses.length} courses`);
    console.log('\nCreated courses:');
    createdCourses.forEach(course => {
      console.log(`- ${course.title} (${course.courseCategory})`);
    });
    
  } catch (error) {
    console.error('Error seeding courses:', error);
  }
}

// Main function
async function main() {
  await connectDB();
  await seedCourses();
  
  // Close connection
  await mongoose.connection.close();
  console.log('\nDatabase connection closed.');
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { getCoursesData, seedCourses };