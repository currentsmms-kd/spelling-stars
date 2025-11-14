export interface Avatar {
  id: string;
  emoji: string;
  name: string;
  category: string;
}

export const AVATARS: Avatar[] = [
  // Animals
  { id: "cat", emoji: "🐱", name: "Cat", category: "Animals" },
  { id: "dog", emoji: "🐶", name: "Dog", category: "Animals" },
  { id: "fox", emoji: "🦊", name: "Fox", category: "Animals" },
  { id: "panda", emoji: "🐼", name: "Panda", category: "Animals" },
  { id: "koala", emoji: "🐨", name: "Koala", category: "Animals" },
  { id: "lion", emoji: "🦁", name: "Lion", category: "Animals" },
  { id: "tiger", emoji: "🐯", name: "Tiger", category: "Animals" },
  { id: "monkey", emoji: "🐵", name: "Monkey", category: "Animals" },
  { id: "rabbit", emoji: "🐰", name: "Rabbit", category: "Animals" },
  { id: "hamster", emoji: "🐹", name: "Hamster", category: "Animals" },
  { id: "bear", emoji: "🐻", name: "Bear", category: "Animals" },
  { id: "frog", emoji: "🐸", name: "Frog", category: "Animals" },

  // Fantasy
  { id: "unicorn", emoji: "🦄", name: "Unicorn", category: "Fantasy" },
  { id: "dragon", emoji: "🐉", name: "Dragon", category: "Fantasy" },
  { id: "fairy", emoji: "🧚", name: "Fairy", category: "Fantasy" },
  { id: "wizard", emoji: "🧙", name: "Wizard", category: "Fantasy" },
  { id: "mermaid", emoji: "🧜", name: "Mermaid", category: "Fantasy" },
  { id: "vampire", emoji: "🧛", name: "Vampire", category: "Fantasy" },
  { id: "alien", emoji: "👽", name: "Alien", category: "Fantasy" },
  { id: "robot", emoji: "🤖", name: "Robot", category: "Fantasy" },

  // Space & Nature
  { id: "star", emoji: "⭐", name: "Star", category: "Space" },
  { id: "moon", emoji: "🌙", name: "Moon", category: "Space" },
  { id: "sun", emoji: "☀️", name: "Sun", category: "Space" },
  { id: "planet", emoji: "🪐", name: "Planet", category: "Space" },
  { id: "rainbow", emoji: "🌈", name: "Rainbow", category: "Nature" },
  { id: "flower", emoji: "🌸", name: "Flower", category: "Nature" },
  { id: "tree", emoji: "🌳", name: "Tree", category: "Nature" },
  { id: "cactus", emoji: "🌵", name: "Cactus", category: "Nature" },

  // Food
  { id: "pizza", emoji: "🍕", name: "Pizza", category: "Food" },
  { id: "ice-cream", emoji: "🍦", name: "Ice Cream", category: "Food" },
  { id: "cookie", emoji: "🍪", name: "Cookie", category: "Food" },
  { id: "cupcake", emoji: "🧁", name: "Cupcake", category: "Food" },
  { id: "donut", emoji: "🍩", name: "Donut", category: "Food" },
  { id: "watermelon", emoji: "🍉", name: "Watermelon", category: "Food" },

  // Sports & Activities
  { id: "soccer", emoji: "⚽", name: "Soccer Ball", category: "Sports" },
  { id: "basketball", emoji: "🏀", name: "Basketball", category: "Sports" },
  { id: "music", emoji: "🎵", name: "Music", category: "Activities" },
  { id: "art", emoji: "🎨", name: "Art", category: "Activities" },
  { id: "book", emoji: "📚", name: "Book", category: "Activities" },
  { id: "gaming", emoji: "🎮", name: "Gaming", category: "Activities" },
];

export function getAvatarById(id: string | null | undefined): Avatar | null {
  if (!id) return null;
  return AVATARS.find((a) => a.id === id) || null;
}

export const FAVORITE_COLORS = [
  { id: "red", name: "Red", hex: "#ef4444" },
  { id: "orange", name: "Orange", hex: "#f97316" },
  { id: "yellow", name: "Yellow", hex: "#eab308" },
  { id: "green", name: "Green", hex: "#22c55e" },
  { id: "blue", name: "Blue", hex: "#3b82f6" },
  { id: "purple", name: "Purple", hex: "#a855f7" },
  { id: "pink", name: "Pink", hex: "#ec4899" },
  {
    id: "rainbow",
    name: "Rainbow",
    hex: "linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ec4899)",
  },
];
