export const QUESTION_CATEGORIES: Record<string, string[]> = {
  "Fun": [
    "If you could instantly master any skill, what would it be?",
    "What's the most useless talent you have?",
    "Which fictional world would you most like to live in?",
    "What's your go-to karaoke song?",
    "If you were a kitchen appliance, which one would you be?",
    "What's the best thing you've eaten this month?",
    "If your pet could talk, what would it complain about?",
    "What's a hobby you picked up and dropped quickly?",
    "Which emoji do you use way too much?",
    "What would your entrance music be?",
    "What's the weirdest food combination you secretly love?",
    "If you could have dinner with any historical figure, who would it be?",
  ],
  "Work": [
    "What's one tool you couldn't do your job without?",
    "What's the best piece of career advice you've received?",
    "What does a perfect workday look like for you?",
    "What's something you learned at work recently?",
    "What was your first ever job?",
    "What's a small habit that makes you more productive?",
    "Which meeting would you happily never attend again?",
    "What's something about your role most people don't know?",
    "What's the best team you've ever been part of, and why?",
    "What's one thing you'd automate if you could?",
  ],
  "Reflective": [
    "What's something you're proud of from the last month?",
    "What's one thing that energized you this week?",
    "Who on the team helped you recently, and how?",
    "What's something you're looking forward to?",
    "What's a mistake that taught you something valuable?",
    "If you could give your past self one piece of advice, what would it be?",
    "What does a great day at work feel like?",
    "What's one thing you'd like to get better at this quarter?",
  ],
  "Would you rather": [
    "Would you rather have unlimited coffee or unlimited snacks at work?",
    "Would you rather only use keyboard shortcuts or only use the mouse forever?",
    "Would you rather work from a beach or a mountain cabin?",
    "Would you rather never have another meeting or never answer another email?",
    "Would you rather be able to read minds or see 10 minutes into the future?",
    "Would you rather explore space or the deep ocean?",
    "Would you rather have a rewind button or a pause button for your life?",
    "Would you rather always be 10 minutes early or 20 minutes late?",
  ],
  "Quick": [
    "Coffee or tea?",
    "Morning person or night owl?",
    "Mountains or beach?",
    "Books or podcasts?",
    "Sweet or savory?",
    "Cats or dogs?",
    "Summer or winter?",
    "Call or text?",
  ],
};

export const ALL_QUESTIONS = Object.values(QUESTION_CATEGORIES).flat();

export const EMOJI_PUZZLES: { emoji: string; answer: string; category: string }[] = [
  { emoji: "🦁👑", answer: "The Lion King", category: "Movie" },
  { emoji: "🚢🧊💔", answer: "Titanic", category: "Movie" },
  { emoji: "🕷️🧑", answer: "Spider-Man", category: "Movie" },
  { emoji: "🧙‍♂️💍🌋", answer: "The Lord of the Rings", category: "Movie" },
  { emoji: "🦖🏝️", answer: "Jurassic Park", category: "Movie" },
  { emoji: "👻🚫", answer: "Ghostbusters", category: "Movie" },
  { emoji: "🐠🔍", answer: "Finding Nemo", category: "Movie" },
  { emoji: "❄️👸", answer: "Frozen", category: "Movie" },
  { emoji: "🤖🌱🚀", answer: "WALL-E", category: "Movie" },
  { emoji: "🧸🤠🚀", answer: "Toy Story", category: "Movie" },
  { emoji: "🍫🏭", answer: "Charlie and the Chocolate Factory", category: "Movie" },
  { emoji: "🦈🏖️", answer: "Jaws", category: "Movie" },
  { emoji: "⏰🔙🚗", answer: "Back to the Future", category: "Movie" },
  { emoji: "🐝🦵", answer: "Bee's knees", category: "Phrase" },
  { emoji: "🌧️🐱🐶", answer: "Raining cats and dogs", category: "Phrase" },
  { emoji: "🍰🚶", answer: "Piece of cake", category: "Phrase" },
  { emoji: "🐘🏠", answer: "Elephant in the room", category: "Phrase" },
  { emoji: "🧊🔨", answer: "Break the ice", category: "Phrase" },
  { emoji: "⏰💸", answer: "Time is money", category: "Phrase" },
  { emoji: "🐦🐦🪨", answer: "Two birds with one stone", category: "Phrase" },
  { emoji: "🍎👁️", answer: "Apple of my eye", category: "Phrase" },
  { emoji: "🔥🧯", answer: "Fighting fires", category: "Work" },
  { emoji: "🐛🔨", answer: "Bug fix", category: "Work" },
  { emoji: "🧑‍💻☕🌙", answer: "Late night coding", category: "Work" },
  { emoji: "📅🔁🏃", answer: "Sprint", category: "Work" },
  { emoji: "🚀📦", answer: "Release", category: "Work" },
  { emoji: "🧱💸", answer: "Technical debt", category: "Work" },
  { emoji: "🦆💬", answer: "Rubber duck debugging", category: "Work" },
  { emoji: "🍕🌍", answer: "Pizza", category: "Food" },
  { emoji: "🍔🍟", answer: "Burger and fries", category: "Food" },
];

export const QUIZ: { q: string; options: string[]; answer: number }[] = [
  { q: "What does HTTP stand for?", options: ["HyperText Transfer Protocol", "High Transfer Text Process", "Hyperlink Text Transport Program", "Host Transfer Type Protocol"], answer: 0 },
  { q: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Mercury"], answer: 1 },
  { q: "In Scrum, who owns the product backlog?", options: ["Scrum Master", "Developers", "Product Owner", "Stakeholders"], answer: 2 },
  { q: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], answer: 3 },
  { q: "How many bits are in a byte?", options: ["4", "8", "16", "32"], answer: 1 },
  { q: "Which language is primarily used to style web pages?", options: ["HTML", "Python", "CSS", "SQL"], answer: 2 },
  { q: "What's the chemical symbol for gold?", options: ["Go", "Gd", "Au", "Ag"], answer: 2 },
  { q: "Which year did the Agile Manifesto come out?", options: ["1995", "2001", "2008", "2012"], answer: 1 },
  { q: "What's the capital of Australia?", options: ["Sydney", "Melbourne", "Canberra", "Perth"], answer: 2 },
  { q: "Which of these is NOT a primary color of light?", options: ["Red", "Green", "Blue", "Yellow"], answer: 3 },
  { q: "What does WIP limit stand for in Kanban?", options: ["Work In Progress", "Weekly Improvement Plan", "Work Item Priority", "Wait In Pipeline"], answer: 0 },
  { q: "How many players are on a soccer team on the field?", options: ["9", "10", "11", "12"], answer: 2 },
  { q: "Which animal is the largest mammal?", options: ["Elephant", "Blue whale", "Giraffe", "Orca"], answer: 1 },
  { q: "What does 'API' stand for?", options: ["Application Programming Interface", "Automated Program Integration", "Applied Protocol Index", "App Processing Input"], answer: 0 },
  { q: "Which is the smallest prime number?", options: ["0", "1", "2", "3"], answer: 2 },
  { q: "Mount Everest sits on the border of Nepal and…?", options: ["India", "China", "Bhutan", "Pakistan"], answer: 1 },
  { q: "Who painted the Mona Lisa?", options: ["Michelangelo", "Raphael", "Leonardo da Vinci", "Donatello"], answer: 2 },
  { q: "What does a 404 status code mean?", options: ["Server error", "Not found", "Unauthorized", "Moved permanently"], answer: 1 },
  { q: "How many continents are there?", options: ["5", "6", "7", "8"], answer: 2 },
  { q: "Which gas do plants absorb from the air?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Helium"], answer: 2 },
  { q: "What is the default branch name most new Git repos use today?", options: ["master", "main", "trunk", "default"], answer: 1 },
  { q: "Which country gifted the Statue of Liberty to the USA?", options: ["UK", "Spain", "France", "Italy"], answer: 2 },
  { q: "In planning poker, what does the ☕ card usually mean?", options: ["Too big", "I need a break", "Unknown", "Zero effort"], answer: 1 },
  { q: "How many sides does a hexagon have?", options: ["5", "6", "7", "8"], answer: 1 },
];

export const THIS_OR_THAT: [string, string][] = [
  ["Coffee", "Tea"], ["Early bird", "Night owl"], ["Beach", "Mountains"], ["Cats", "Dogs"], ["Books", "Movies"], ["Sweet", "Savory"],
  ["Summer", "Winter"], ["Call", "Text"], ["Tabs", "Spaces"], ["Dark mode", "Light mode"], ["Office", "Remote"], ["Pizza", "Tacos"],
  ["Plan everything", "Go with the flow"], ["City", "Countryside"], ["Board games", "Video games"], ["Sunrise", "Sunset"], ["Pen", "Keyboard"],
  ["Podcast", "Music"], ["Big team", "Small team"], ["Meetings", "Async updates"], ["Chocolate", "Vanilla"], ["Train", "Plane"],
  ["Spreadsheets", "Slides"], ["Sci-fi", "Fantasy"], ["Breakfast", "Dinner"], ["Hot weather", "Cold weather"], ["Front end", "Back end"],
];

export const SPECTRUMS: [string, string][] = [
  ["Plan every detail", "Make it up as I go"], ["Inbox zero", "10,000 unread"], ["Morning person", "Night person"], ["Introvert", "Extrovert"],
  ["Minimalist", "Collector"], ["Big picture", "Fine details"], ["Cooks every night", "Lives on takeout"], ["Never late", "Always late"],
  ["Quiet focus music", "Loud everything"], ["Cautious", "Adventurous"], ["Tidy desk", "Creative chaos"], ["Reads the manual", "Figures it out"],
  ["Spontaneous trips", "Booked a year ahead"], ["Spicy food fan", "Mild please"], ["One tab open", "200 tabs open"], ["Talk it out", "Write it down"],
];

export const PUNCHLINE_SETUPS = [
  "Why did the developer go broke?",
  "What's the real reason the sprint was late?",
  "Why did the scrum master bring a ladder to the meeting?",
  "What did the server say to the client?",
  "Why was the meeting room always so cold?",
  "What's the worst thing to hear right before a demo?",
  "Why did the product owner cross the road?",
  "What's written on a tester's tombstone?",
  "Why don't stand-ups ever sit down?",
  "What did the Wi-Fi say to the laptop?",
  "Why was the spreadsheet so stressed?",
  "What's the secret ingredient in our team's success?",
  "Why did the bug refuse to leave?",
  "What's the real definition of 'quick sync'?",
  "Why did the coffee machine file a complaint?",
];

export const SCAVENGER_PROMPTS = [
  "Something blue", "A mug with writing on it", "Something older than you", "A book you'd recommend", "Something that makes noise",
  "Something round", "A plant (real or fake!)", "Something from another country", "The oddest object on your desk", "Something soft",
  "A photo or picture of someone you love", "Something with a logo on it", "A snack", "Something that starts with the letter S", "A pen that works",
  "Something red", "Your favorite gadget", "Something handmade", "Something that lights up", "A hat",
];

export const SKETCH_WORDS = [
  "rocket", "coffee", "bicycle", "pizza", "rainbow", "robot", "castle", "octopus", "umbrella", "volcano", "guitar", "snowman", "lighthouse",
  "dragon", "cactus", "penguin", "hamburger", "airplane", "tree house", "dinosaur", "sandcastle", "treasure map", "spaceship", "bug", "deadline",
  "sprint", "rubber duck", "laptop", "sunglasses", "campfire", "hot air balloon", "ice cream", "unicorn", "sailboat", "telescope", "kangaroo",
  "headphones", "skateboard", "submarine", "mushroom", "whale", "light bulb", "tornado", "piano", "trophy", "magnet", "bridge", "clock",
];

export const IMPOSTER_WORDS: { category: string; words: string[] }[] = [
  { category: "Food", words: ["Pizza", "Sushi", "Tacos", "Pancakes", "Curry", "Burger"] },
  { category: "Animals", words: ["Penguin", "Giraffe", "Octopus", "Kangaroo", "Owl", "Shark"] },
  { category: "Places", words: ["Beach", "Library", "Airport", "Museum", "Hospital", "Stadium"] },
  { category: "Jobs", words: ["Pilot", "Chef", "Teacher", "Firefighter", "Astronaut", "Plumber"] },
  { category: "Sports", words: ["Tennis", "Surfing", "Chess", "Basketball", "Skiing", "Golf"] },
  { category: "Things at work", words: ["Stapler", "Whiteboard", "Coffee machine", "Laptop", "Calendar", "Badge"] },
  { category: "Weather", words: ["Thunderstorm", "Fog", "Rainbow", "Snow", "Heatwave", "Hail"] },
];

export const AGILITY_PROMPTS = [
  "Our velocity dropped because of ___.",
  "The real definition of done is ___.",
  "In the retro, everyone agreed the problem was ___.",
  "The sprint goal this week: ___.",
  "Nobody expected the demo to include ___.",
  "Our next team offsite will be at ___.",
  "The secret to a 15-minute standup is ___.",
  "The product owner just added ___ to the backlog.",
  "Production went down because of ___.",
  "Our new team motto: ___.",
  "The stakeholders were thrilled by ___.",
  "What's blocking the release? ___.",
  "I estimated it as a 3, but then ___.",
  "The latest process improvement: ___.",
  "My first week on the team taught me about ___.",
];

export const AGILITY_ANSWERS = [
  "A surprise all-hands meeting", "Infinite scope creep", "The printer, again", "A rubber duck named Gary", "Mandatory fun",
  "Seventeen browser tabs", "A dependency nobody has heard of", "Moving the ticket to Done anyway", "Pair programming with a cat",
  "A 2-hour 'quick sync'", "The coffee machine being broken", "Blaming DNS", "An extremely confident estimate", "Sticky notes everywhere",
  "A Gantt chart in disguise", "Reply-all chaos", "The intern's side project", "A spreadsheet with 40 tabs", "Burnout-flavored pizza",
  "A demo that only works on my machine", "Velocity points as currency", "A retro about retros", "Agile with a 6-month plan",
  "The legacy system nobody understands", "A very passionate code review", "A meeting that could have been an email",
  "Rewriting everything in a new framework", "A suspiciously green dashboard", "Emoji-only status updates", "An all-day planning session",
  "The CEO's brilliant new idea", "Feature flags for feature flags", "Unlimited snacks", "A post-it note with the password",
  "The definition of ready", "A surprise audit", "Friday afternoon deploys", "A heroic late-night hotfix", "Shadow IT", "Kanban for lunch orders",
  "A backlog of 3,000 tickets", "The team mascot", "Dancing at standup", "Silence on mute", "A merge conflict the size of a novel",
];

export const PITCH_PRODUCTS = [
  "A smart umbrella", "Self-tying shoelaces", "An app for plants", "A meeting-ending button", "Socks that find their pair", "A toaster with Wi-Fi",
  "Edible coffee cups", "A pillow that tells stories", "Noise-cancelling walls", "A pet translator", "A desk that tidies itself", "Glow-in-the-dark paint for bikes",
];
export const PITCH_AUDIENCES = [
  "busy parents", "astronauts", "retired pirates", "college students", "remote workers", "dog walkers", "chefs", "night-shift nurses",
  "time travelers", "professional gamers", "farmers", "superheroes",
];
export const PITCH_TWISTS = ["…but it must be under $10", "…and it runs on solar power", "…but it only works on Tuesdays", "…and it has to be subscription-based", "…but it's made entirely of cardboard", "…and it talks"];

export const SLIDE_PROMPTS = [
  { emoji: "📈", title: "Q3 results: penguin edition" },
  { emoji: "🦄", title: "Our unicorn strategy" },
  { emoji: "🍕", title: "Pizza-driven development" },
  { emoji: "🌋", title: "Lessons from the volcano incident" },
  { emoji: "🐙", title: "Why our org chart is an octopus" },
  { emoji: "🚀", title: "Roadmap to the moon" },
  { emoji: "🧀", title: "The cheese supply chain" },
  { emoji: "🎻", title: "Orchestrating microservices" },
  { emoji: "🦖", title: "Legacy systems: a natural history" },
  { emoji: "🌮", title: "Taco Tuesday KPIs" },
  { emoji: "🧲", title: "Attracting top talent with magnets" },
  { emoji: "🛸", title: "Customer research on Mars" },
  { emoji: "🐢", title: "Slow and steady wins sprints" },
  { emoji: "🎢", title: "Our quarterly emotional journey" },
  { emoji: "🧩", title: "The missing piece of our process" },
  { emoji: "🥑", title: "The avocado pivot" },
];

export const STORY_STARTERS = ["Once upon a time, in a team far away,", "It was the night before the big release, and", "Nobody expected the sprint review to", "The coffee machine suddenly started", "On the first day back from holiday,"];
export const WORD_STARTERS = ["Ocean", "Coffee", "Launch", "Team", "Summer", "Code", "Dream", "Bridge", "Forest", "Music", "Rocket", "Garden", "Puzzle", "Mountain"];
export const MISSION_PROMPTS = ["What do you most want to achieve this quarter?", "What would make the next sprint a success for you?", "What's one thing you want our team to be known for?"];
