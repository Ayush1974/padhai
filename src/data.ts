import type { Profile, StudyRoom } from './types';

export const defaultProfile: Profile = {
  name: 'Student', exam: 'GATE', dailyGoal: 240, language: 'en', lowData: false, examDate: '',
};

export const rooms: StudyRoom[] = [
{ id: 'gate-cs-library', name: 'GATE CS Study Room', description: 'Algorithms, systems, and one focused session at a time.', exam: 'GATE', image: '/jee.jpg', minutes: 50, tag: 'GATE CS', color: 'purple' },
  { id: 'jee-library', name: 'The JEE Library', description: 'One problem closer to your dream IIT.', exam: 'JEE', image: '/jee.jpg', minutes: 50, tag: 'Deep focus', color: 'orange' },
  { id: 'neet-garden', name: 'Future Doctors Club', description: 'Big dreams. Small, consistent steps.', exam: 'NEET', image: '/neet.jpg', minutes: 25, tag: 'Pomodoro', color: 'green' },
  { id: 'upsc-reading', name: 'The UPSC Reading Room', description: 'For the ones with a bigger purpose.', exam: 'UPSC', image: '/upsc.jpg', minutes: 50, tag: 'Quiet space', color: 'blue' },
  { id: 'school-desk', name: 'After School Hours', description: 'Homework, boards, and a little company.', exam: 'School', image: '/school.jpg', minutes: 25, tag: 'Study together', color: 'purple' },
  { id: 'college-cafe', name: 'The Campus Café', description: 'Assignments feel lighter together.', exam: 'College', image: '/college.jpg', minutes: 50, tag: 'Chill & focus', color: 'brown' },
  { id: 'night-owls', name: 'The Night Owls', description: 'A quiet corner for your next big idea.', exam: 'Other', image: '/night.jpg', minutes: 25, tag: 'All-nighter club', color: 'blue' },
];

export const resources = [
  { name: 'NCERT textbooks', description: 'The foundations, straight from the source. Free textbooks for classes I–XII.', tag: 'School · JEE · NEET', url: 'https://epathshala.ncert.gov.in/process.php?id=students&type=eTextbooks&ln=en', icon: 'book', color: 'orange' },
  { name: 'DIKSHA', description: 'Lessons, practice and learning material in Indian languages.', tag: 'School · Multilingual', url: 'https://diksha.gov.in/', icon: 'globe', color: 'green' },
  { name: 'SWAYAM', description: 'Explore free courses from Indian universities and institutions. Certificates may have fees.', tag: 'College · Upskilling', url: 'https://swayam.gov.in/', icon: 'cap', color: 'blue' },
  { name: 'NTA', description: 'Official exam information and notices. Confirm dates on the official exam website.', tag: 'JEE · NEET · CUET', url: 'https://nta.ac.in/NoticeBoardArchive', icon: 'file', color: 'purple' },
  { name: 'UPSC previous papers', description: 'Get familiar with the real questions from previous examinations.', tag: 'UPSC · Practice', url: 'https://www.upsc.gov.in/exam-documents/question-papers/', icon: 'file', color: 'brown' },
  { name: 'NPTEL', description: 'Free engineering, science and humanities lectures from IITs and IISc.', tag: 'College · GATE', url: 'https://nptel.ac.in/', icon: 'cap', color: 'green' },
];

export const quotes = [
  'You don’t have to see the whole staircase. Just take the next step.',
  'A little better than yesterday. That’s enough.',
  'Your future self is quietly cheering for you.',
  'Consistency is a superpower. You’re building yours.',
];
