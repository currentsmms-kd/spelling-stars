# New Libraries Integration Guide

**Installed: November 10, 2025**

All libraries are compatible with React 18 and your existing stack. Here's how to use them in SpellStars:

---

## 🎨 Animation Libraries

### 1. Framer Motion (Primary Animation Library)

**Best for:** Page transitions, button animations, celebration effects, smooth UI interactions

**Basic Usage:**

```tsx
import { motion } from 'framer-motion';

// Animated button
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  className="child-button"
>
  Start Game!
</motion.button>

// Fade in animation
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
  <Card>Content here</Card>
</motion.div>

// List animations
<motion.ul>
  {items.map((item) => (
    <motion.li
      key={item.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      {item.text}
    </motion.li>
  ))}
</motion.ul>
```

**Perfect for SpellStars:**

- Child button press feedback (scale animations)
- Card entrance animations on game start
- Success/failure state transitions
- Smooth navigation between game screens
- Sticker/badge reveal animations

**Advanced Example - Success Celebration:**

```tsx
import { motion } from "framer-motion";

const SuccessMessage = ({ word }: { word: string }) => (
  <motion.div
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    transition={{
      type: "spring",
      stiffness: 260,
      damping: 20,
    }}
    className="text-center"
  >
    <motion.h2
      animate={{
        rotate: [0, -10, 10, -10, 0],
      }}
      transition={{ duration: 0.5 }}
      className="text-6xl"
    >
      🎉
    </motion.h2>
    <p className="child-text">Perfect! You spelled "{word}" correctly!</p>
  </motion.div>
);
```

---

### 2. AutoAnimate

**Best for:** Automatic smooth transitions when lists change (EASIEST option!)

**Basic Usage:**

```tsx
import { useAutoAnimate } from "@formkit/auto-animate/react";

export function WordList() {
  const [parent] = useAutoAnimate();

  return (
    <ul ref={parent}>
      {words.map((word) => (
        <li key={word.id}>{word.text}</li>
      ))}
    </ul>
  );
}
```

**Perfect for SpellStars:**

- Word list reordering in parent dashboard
- Adding/removing words from lists
- Sticker collection updates
- Badge award animations

**No configuration needed** - just add the ref and it works!

---

## 🎢 Swiper.js

**Best for:** Touch-friendly carousels, image galleries, card swiping

**Basic Usage:**

```tsx
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";

export function StickerCarousel({ stickers }: { stickers: Sticker[] }) {
  return (
    <Swiper spaceBetween={20} slidesPerView={3} loop={true}>
      {stickers.map((sticker) => (
        <SwiperSlide key={sticker.id}>
          <img src={sticker.image_url} alt={sticker.name} />
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
```

**Perfect for SpellStars:**

- Sticker collection browsing (swipe through earned stickers)
- Word list preview (swipe through words in a list)
- Theme gallery (swipe through color themes)
- Tutorial slides for children

**Child-Friendly Config:**

```tsx
<Swiper
  spaceBetween={30}
  slidesPerView={1}
  grabCursor={true} // Shows grab cursor
  loop={true} // Infinite loop
  centeredSlides={true}
  pagination={{ clickable: true }} // Dots at bottom
>
  {/* slides */}
</Swiper>
```

---

## 🎯 Drag & Drop (@dnd-kit)

**Best for:** Reordering word lists, organizing stickers, sortable tables

**Basic Usage:**

```tsx
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Item Component
function SortableWord({ id, text }: { id: string; text: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {text}
    </div>
  );
}

// Container Component
function ReorderableWordList() {
  const [words, setWords] = useState([...]);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event) {
    const { active, over } = event;

    if (active.id !== over.id) {
      setWords((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={words} strategy={verticalListSortingStrategy}>
        {words.map((word) => (
          <SortableWord key={word.id} id={word.id} text={word.text} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

**Perfect for SpellStars:**

- Replace your existing `useReorderWords()` implementation
- Parent dashboard: reorder words in lists
- Parent dashboard: reorder lists themselves
- More accessible than react-beautiful-dnd (keyboard support built-in)

**Integration with your existing code:**
Update `src/app/pages/parent/ListEditor.tsx` to use @dnd-kit instead of manual drag handlers

---

## 🍞 React Hot Toast

**Best for:** User feedback, notifications, success/error messages

**Setup (add to main.tsx):**

```tsx
import { Toaster } from "react-hot-toast";

// In your App component
<Toaster
  position="top-center"
  toastOptions={{
    duration: 3000,
    style: {
      background: "var(--card)",
      color: "var(--card-foreground)",
      border: "2px solid var(--border)",
      boxShadow: "var(--shadow)",
    },
  }}
/>;
```

**Basic Usage:**

```tsx
import toast from "react-hot-toast";

// Success
toast.success("Word added successfully!");

// Error
toast.error("Failed to save word");

// Custom
toast("New badge earned! 🏆", {
  icon: "🎉",
  duration: 4000,
});

// With custom styling
toast.success("Correct!", {
  style: {
    fontSize: "24px",
    padding: "20px",
  },
});
```

**Perfect for SpellStars:**

- Word saved confirmation (parent side)
- Network status (offline/online)
- Badge/sticker earned notifications
- Sync completion messages
- Error handling (user-friendly)

**Replace console.log with toast in sync.ts:**

```tsx
// Instead of:
console.log("Sync completed");

// Use:
toast.success("Practice synced! 🎉");
```

---

## 🎣 React Use (Utility Hooks)

**Best for:** Common React patterns without writing custom hooks

**Useful Hooks for SpellStars:**

### useLocalStorage

```tsx
import { useLocalStorage } from "react-use";

// Store child's last played list
const [lastListId, setLastListId] = useLocalStorage("last-list-id", null);
```

### useDebounce

```tsx
import { useDebounce } from "react-use";

// Search words in parent dashboard
const [searchTerm, setSearchTerm] = useState("");
const debouncedSearch = useDebounce(searchTerm, 500);

useEffect(() => {
  // Search only fires after 500ms of no typing
  searchWords(debouncedSearch);
}, [debouncedSearch]);
```

### useToggle

```tsx
import { useToggle } from "react-use";

const [isPlaying, togglePlaying] = useToggle(false);
// Instead of: const [isPlaying, setIsPlaying] = useState(false);
```

### useInterval

```tsx
import { useInterval } from "react-use";

// Session timer
const [seconds, setSeconds] = useState(0);
useInterval(() => {
  setSeconds(seconds + 1);
}, 1000);
```

### useClickAway

```tsx
import { useClickAway } from "react-use";

// Close dropdown when clicking outside
const ref = useRef(null);
useClickAway(ref, () => {
  setIsOpen(false);
});
```

**Many more available:** <https://github.com/streamich/react-use>

---

## ✏️ React Sketch Canvas

**Best for:** Drawing/writing practice, signature capture

**Basic Usage:**

```tsx
import { ReactSketchCanvas } from "react-sketch-canvas";

export function DrawingPractice({ word }: { word: string }) {
  const canvasRef = useRef(null);

  const handleClear = () => {
    canvasRef.current?.clearCanvas();
  };

  const handleSave = async () => {
    const paths = await canvasRef.current?.exportPaths();
    // Save drawing data
  };

  return (
    <div>
      <h2 className="child-heading">Draw the word: {word}</h2>
      <ReactSketchCanvas
        ref={canvasRef}
        strokeWidth={4}
        strokeColor="var(--primary)"
        canvasColor="var(--background)"
        style={{
          border: "2px solid var(--border)",
          borderRadius: "8px",
        }}
      />
      <div className="flex gap-4 mt-4">
        <Button size="child" onClick={handleClear}>
          Clear
        </Button>
        <Button size="child" onClick={handleSave}>
          Save Drawing
        </Button>
      </div>
    </div>
  );
}
```

**Perfect for SpellStars:**

- Optional drawing practice mode
- "Trace the word" exercise for younger kids
- Parent signature for consent forms
- Creative mode - draw pictures related to words

---

## 🎊 Canvas Confetti (Already Installed)

**Best for:** Celebration effects on correct answers

**Basic Usage:**

```tsx
import confetti from "canvas-confetti";

// Simple confetti burst
const celebrate = () => {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
  });
};

// Continuous confetti (for session complete)
const celebrateBig = () => {
  const duration = 3000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 2,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
    });
    confetti({
      particleCount: 2,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
};

// Star confetti for spelling success
const starBurst = () => {
  confetti({
    particleCount: 50,
    spread: 360,
    shapes: ["star"],
    scalar: 1.5,
    colors: ["#FFD700", "#FFA500", "#FF69B4"],
  });
};
```

**Perfect for SpellStars:**

- Correct answer celebration in games
- Session complete screen
- Badge/sticker earned moment
- Level up celebrations

**Integrate with PlayListenType.tsx and PlaySaySpell.tsx:**

```tsx
const handleCorrectAnswer = async () => {
  // Show confetti
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
  });

  // Existing success logic...
};
```

---

## 📋 Quick Integration Checklist

### High Priority (Implement First)

- [ ] Add `<Toaster />` to `main.tsx` for notifications
- [ ] Replace word reordering with @dnd-kit in `ListEditor.tsx`
- [ ] Add confetti to success states in game components
- [ ] Wrap child buttons with Framer Motion for better feedback

### Medium Priority

- [ ] Add AutoAnimate to word lists for smooth transitions
- [ ] Use Swiper for sticker collection browsing
- [ ] Add useDebounce for search in parent dashboard
- [ ] Animate page transitions with Framer Motion

### Low Priority (Nice to Have)

- [ ] Add React Sketch Canvas as optional drawing mode
- [ ] Use more react-use hooks to simplify custom hooks
- [ ] Add advanced confetti patterns for achievements

---

## 🎯 Example: Enhanced Button Component

Update `src/app/components/Button.tsx` to use Framer Motion:

```tsx
import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(/* existing variants */);

interface ButtonProps
  extends HTMLMotionProps<"button">,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
```

---

## 📚 Additional Resources

- **Framer Motion:** <https://www.framer.com/motion/>
- **@dnd-kit:** <https://docs.dndkit.com/>
- **Swiper:** <https://swiperjs.com/react>
- **React Hot Toast:** <https://react-hot-toast.com/>
- **React Use:** <https://github.com/streamich/react-use>
- **AutoAnimate:** <https://auto-animate.formkit.com/>
- **Canvas Confetti:** <https://github.com/catdad/canvas-confetti>

---

## ⚡ Performance Notes

All libraries are:

- ✅ Compatible with React 18
- ✅ TypeScript-friendly
- ✅ Tree-shakeable (only import what you use)
- ✅ SSR-compatible (for future Vercel deployment)
- ✅ Accessible (WCAG compliant)

**Bundle impact:**

- Framer Motion: ~40KB gzipped
- @dnd-kit: ~20KB gzipped
- Swiper: ~30KB gzipped (only if used)
- React Hot Toast: ~5KB gzipped
- AutoAnimate: ~3KB gzipped
- React Use: ~1-2KB per hook (tree-shakeable)

Total addition: ~100KB gzipped (well within acceptable range for a PWA)
