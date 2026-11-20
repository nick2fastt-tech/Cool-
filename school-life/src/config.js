// School Life — game configuration (Demo V1.00)
// Everything a designer might want to tweak lives here.

export const GAME = {
  title: 'School Life',
  version: 'V1.00',
  versionLabel: 'Demo V1.00',
  school: 'School Life Academy',
};

// The six rooms in the demo (all on the 1st floor).
// You listed two rooms as "102", so they are numbered 101-106 in the order you gave them.
export const ROOMS = {
  101: { id: 101, name: 'Math', sign: 'MATH', color: '#e4572e' },
  102: { id: 102, name: 'Auditorium', sign: 'AUDITORIUM', color: '#8e44ad' },
  103: { id: 103, name: 'Algebra I', sign: 'ALGEBRA I', color: '#2d7dd2' },
  104: { id: 104, name: 'Photosynthesis', sign: 'PHOTOSYNTHESIS', color: '#3bb273' },
  105: { id: 105, name: 'English', sign: 'ENGLISH', color: '#f2a541' },
  106: { id: 106, name: 'Library', sign: 'LIBRARY', color: '#c0392b' },
};

// School day. The game clock starts at 8:00 AM when you press Play and goes up
// 1 minute every 60 seconds. Classes are 30 minutes with a 1-minute break, so
// 1st period is 8:00-8:30 and the bell at 8:31 starts 2nd period. 8th period is
// 45 minutes, so school lets out at 12:22 PM. You're late if you're not in class
// 15 minutes after it starts (8:15 for 1st period).
export const SCHEDULE = {
  startHour: 8,
  startMinute: 0,
  classMinutes: 30,
  lastClassMinutes: 45,
  passingMinutes: 1,
  lateAfterMinutes: 15,
  realSecondsPerGameMinute: 60,
  afterSchoolMinutes: 1, // then a new school day starts at 8:00 AM
};

// The 8 classes, and each grade's order. Homeroom room changes by grade.
export const GRADES = [6, 7, 8, 9];

export const GRADE_SCHEDULES = {
  6: [
    ['Homeroom', 101], ['English', 105], ['Math', 101], ['Photosynthesis', 104],
    ['Library', 106], ['Auditorium', 102], ['Algebra I', 103], ['Study Hall', 106],
  ],
  7: [
    ['Homeroom', 103], ['English', 105], ['Math', 101], ['Library', 106],
    ['Algebra I', 103], ['Photosynthesis', 104], ['Auditorium', 102], ['Study Hall', 106],
  ],
  8: [
    ['Homeroom', 104], ['Algebra I', 103], ['Photosynthesis', 104], ['Math', 101],
    ['English', 105], ['Library', 106], ['Auditorium', 102], ['Study Hall', 106],
  ],
  9: [
    ['Homeroom', 105], ['Photosynthesis', 104], ['Algebra I', 103], ['English', 105],
    ['Library', 106], ['Math', 101], ['Auditorium', 102], ['Study Hall', 106],
  ],
};

// Everyone is male (5'9") or female (5'3"), with brown hair, a white t-shirt,
// jeans and black shoes.
export const BODY = {
  male: { label: 'Male', height: 1.753, heightLabel: '5\'9"' },
  female: { label: 'Female', height: 1.6, heightLabel: '5\'3"' },
};

export const COLORS = {
  hair: 0x5a3a22,
  shirt: 0xf4f4f2,
  jeans: 0x34527a,
  shoes: 0x161616,
};

// Welcome email / letter content. Used by both the server and the in-game letter.
export const WELCOME = {
  subject: 'Welcome to School Life! \u{1F392}',
  intro: 'I hope you enjoy this game!',
  features: [
    '8 classes from 8:00 AM to 12:22 PM: 30 minutes each, and 8th period is 45 minutes',
    'The clock goes up 1 minute every minute. Get to class within 15 minutes or you\'re late!',
    'Pick 6th, 7th, 8th or 9th grade',
    '6 rooms: 101 Math, 102 Auditorium (seats + a stage), 103 Algebra I, 104 Photosynthesis, 105 English and 106 Library',
    'The Library has seats, comfy lounges and the Principal\'s Office (no entry yet!)',
    '2 floors — the 2nd floor is still under construction',
    'First-person controls: grey joystick, Use button and a live schedule',
    'Max graphics with no lag',
  ],
  comingSoon: 'Coming soon: character customization, the gym, the 2nd floor and more.',
  signoff: 'See you in class!\n— The School Life Team',
};

// Optional: send the welcome email straight from the game with EmailJS
// (works on static hosting like GitHub Pages, no server needed). See README.
// When the game is served by server/index.js, the server sends the email instead.
export const EMAIL_CONFIG = {
  emailjs: { serviceId: '', templateId: '', publicKey: '' },
};
