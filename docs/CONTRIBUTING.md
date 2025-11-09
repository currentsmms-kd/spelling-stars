# Contributing to SpellStars

Thank you for considering contributing to SpellStars! This document provides guidelines for contributing.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Keep discussions on topic

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a feature branch
4. Make your changes
5. Test thoroughly
6. Submit a pull request

## Development Setup

See [QUICKSTART.md](./QUICKSTART.md) for initial setup.

## Project Structure

- `/src/app/components` - Reusable UI components
- `/src/app/pages` - Page components
- `/src/app/hooks` - Custom React hooks
- `/src/app/store` - Zustand state management
- `/src/data` - Dexie database schema
- `/src/lib` - Utility functions
- `/src/styles` - Global styles

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Define proper types and interfaces
- Avoid `any` type when possible
- Use type inference where appropriate

### React

- Use functional components with hooks
- Keep components small and focused
- Use custom hooks for reusable logic
- Follow React best practices

### Styling

- Use Tailwind utility classes
- Follow existing design patterns
- Ensure responsive design
- Test on mobile devices

### Naming Conventions

- Components: PascalCase (`Button.tsx`)
- Hooks: camelCase with 'use' prefix (`useAuth.ts`)
- Utilities: camelCase (`cn`, `formatDate`)
- Constants: UPPER_SNAKE_CASE

## Testing

Before submitting:

- Test on multiple browsers
- Test responsive design
- Test offline functionality
- Test with slow network
- Check accessibility

## Pull Request Process

1. Update documentation if needed
2. Add comments for complex logic
3. Follow existing code style
4. Keep PRs focused on single feature
5. Write clear commit messages
6. Reference related issues

## Feature Ideas

Want to contribute but not sure what to work on? Here are some ideas:

### High Priority

- [ ] Speech recognition for "Say & Spell" mode
- [ ] Parent-child account linking
- [ ] Progress analytics dashboard
- [ ] Audio pronunciation for words
- [ ] Import/export word lists

### Medium Priority

- [ ] Multiplayer spelling games
- [ ] Custom themes/avatars
- [ ] Spelling bee mode
- [ ] Print word lists
- [ ] Share lists between parents

### Nice to Have

- [ ] Dark mode
- [ ] Multiple languages
- [ ] Gamification enhancements
- [ ] Social features
- [ ] Mobile apps (React Native)

## Questions?

Open an issue for:

- Bug reports
- Feature requests
- Questions
- Documentation improvements

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
