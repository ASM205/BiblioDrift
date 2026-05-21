
/**
 * BiblioDrift 3D Bookshelf Library
 * Handles the interactive 3D bookshelf experience with hover tooltips and detail modals
 */

// Sample books data for demonstration
export const SAMPLE_BOOKS = {
    current: [
        {
            id: 'sample-1',
            title: 'The Great Gatsby',
            author: 'F. Scott Fitzgerald',
            cover: 'https://covers.openlibrary.org/b/id/7222246-M.jpg',
            rating: 4.2,
            ratingCount: 4523,
            description: 'The story of the mysteriously wealthy Jay Gatsby and his love for the beautiful Daisy Buchanan, of lavish parties on Long Island at a time when The New York Times noted "ichthyosaurus" was among the most popular dance steps. This exemplary novel of the Jazz Age has been acclaimed by generations of readers.',
            categories: ['Classic', 'Literary Fiction', 'American'],
            spineColor: '#1a472a',
            textColor: '#d4af37',
            reviews: [
                { name: 'Literature Lover', rating: 5, text: 'A masterpiece of American literature that captures the essence of the roaring twenties.' },
                { name: 'BookwormSarah', rating: 4, text: 'The prose is absolutely beautiful. Fitzgerald\'s writing is unmatched.' }
            ]
        },
        {
            id: 'sample-2',
            title: 'Pride and Prejudice',
            author: 'Jane Austen',
            cover: 'https://covers.openlibrary.org/b/id/12645114-M.jpg',
            rating: 4.5,
            ratingCount: 3892,
            description: 'Since its immediate success in 1813, Pride and Prejudice has remained one of the most popular novels in the English language. Jane Austen called this brilliant work "her own darling child" and its witty portrayal of country society and the courtship of Elizabeth Bennet and Mr. Darcy has captivated readers for centuries.',
            categories: ['Classic', 'Romance', 'British'],
            spineColor: '#8B4513',
            textColor: '#FFEFD5',
            reviews: [
                { name: 'JaneiteForever', rating: 5, text: 'The perfect blend of wit, romance, and social commentary.' },
                { name: 'ClassicReader', rating: 5, text: 'Elizabeth Bennet is one of the most beloved heroines in literature.' }
            ]
        },
        {
            id: 'sample-3',
            title: '1984',
            author: 'George Orwell',
            cover: 'https://covers.openlibrary.org/b/id/9269962-M.jpg',
            rating: 4.3,
            ratingCount: 5621,
            description: 'Winston Smith works for the Ministry of Truth in London, chief city of Airstrip One. Big Brother stares out from every poster, the Thought Police uncover each act of betrayal. When Winston finds love with Julia, he discovers life does not have to be dull and deadening.',
            categories: ['Dystopian', 'Science Fiction', 'Political'],
            spineColor: '#2F4F4F',
            textColor: '#FF6347',
            reviews: [
                { name: 'DystopiaFan', rating: 5, text: 'Frighteningly relevant even decades after it was written.' },
                { name: 'PoliticalReader', rating: 4, text: 'A chilling masterpiece that makes you question everything.' }
            ]
        }
    ],
    want: [
        {
            id: 'sample-4',
            title: 'To Kill a Mockingbird',
            author: 'Harper Lee',
            cover: 'https://covers.openlibrary.org/b/id/8314134-M.jpg',
            rating: 4.6,
            ratingCount: 4789,
            description: 'The unforgettable novel of a childhood in a sleepy Southern town and the crisis of conscience that rocked it. Through the young eyes of Scout and Jem Finch, Harper Lee explores with rich humor and unswerving honesty the irrationality of adult attitudes toward race and class.',
            categories: ['Classic', 'Literary Fiction', 'Southern'],
            spineColor: '#654321',
            textColor: '#FFFAF0',
            reviews: [
                { name: 'SouthernReader', rating: 5, text: 'A powerful story that stays with you forever.' },
                { name: 'BookClubMember', rating: 5, text: 'Atticus Finch is the moral compass we all need.' }
            ]
        },
        {
            id: 'sample-5',
            title: 'The Alchemist',
            author: 'Paulo Coelho',
            cover: 'https://covers.openlibrary.org/b/id/7884852-M.jpg',
            rating: 4.1,
            ratingCount: 3156,
            description: 'Paulo Coelho\'s masterpiece tells the mystical story of Santiago, an Andalusian shepherd boy who yearns to travel in search of a worldly treasure. His quest will lead him to riches far different—and far more satisfying—than he ever imagined.',
            categories: ['Philosophy', 'Fiction', 'Adventure'],
            spineColor: '#DAA520',
            textColor: '#2F1810',
            reviews: [
                { name: 'SpiritualSeeker', rating: 5, text: 'A beautiful reminder to follow your dreams.' },
                { name: 'WorldTraveler', rating: 4, text: 'Every page is filled with wisdom and magic.' }
            ]
        },
        {
            id: 'sample-6',
            title: 'The Midnight Library',
            author: 'Matt Haig',
            cover: 'https://covers.openlibrary.org/b/id/10389354-M.jpg',
            rating: 4.0,
            ratingCount: 2845,
            description: 'Between life and death there is a library, and within that library, the shelves go on forever. Every book provides a chance to try another life you could have lived. To see how things would be if you had made other choices.',
            categories: ['Contemporary', 'Fantasy', 'Philosophy'],
            spineColor: '#191970',
            textColor: '#E6E6FA',
            reviews: [
                { name: 'ModernReader', rating: 4, text: 'A thought-provoking exploration of regret and possibility.' },
                { name: 'FantasyLover', rating: 5, text: 'Beautifully written with an uplifting message.' }
            ]
        },
        {
            id: 'sample-7',
            title: 'Atomic Habits',
            author: 'James Clear',
            cover: 'https://covers.openlibrary.org/b/id/10958382-M.jpg',
            rating: 4.4,
            ratingCount: 6234,
            description: 'No matter your goals, Atomic Habits offers a proven framework for improving—every day. James Clear reveals practical strategies that will teach you exactly how to form good habits, break bad ones, and master the tiny behaviors that lead to remarkable results.',
            categories: ['Self-Help', 'Psychology', 'Productivity'],
            spineColor: '#FF8C00',
            textColor: '#FFFFFF',
            reviews: [
                { name: 'ProductivityGuru', rating: 5, text: 'Life-changing advice backed by science.' },
                { name: 'SelfImprover', rating: 4, text: 'Practical tips that actually work in real life.' }
            ]
        }
    ],
    finished: [
        {
            id: 'sample-8',
            title: 'The Catcher in the Rye',
            author: 'J.D. Salinger',
            cover: 'https://covers.openlibrary.org/b/id/8231994-M.jpg',
            rating: 3.8,
            ratingCount: 3421,
            description: 'The hero-narrator of The Catcher in the Rye is an ancient child of sixteen, a native New Yorker named Holden Caulfield. Through circumstances that tend to preclude adult, secondhand description, he leaves his prep school in Pennsylvania and goes underground in New York City for three days.',
            categories: ['Classic', 'Coming-of-Age', 'American'],
            spineColor: '#8B0000',
            textColor: '#FFD700',
            reviews: [
                { name: 'TeenReader', rating: 4, text: 'Holden\'s voice captures teenage angst perfectly.' },
                { name: 'LitMajor', rating: 3, text: 'An important work though divisive in reception.' }
            ]
        },
        {
            id: 'sample-9',
            title: 'Sapiens',
            author: 'Yuval Noah Harari',
            cover: 'https://covers.openlibrary.org/b/id/8406786-M.jpg',
            rating: 4.5,
            ratingCount: 5432,
            description: 'How did our species succeed in the battle for dominance? Why did our foraging ancestors come together to create cities and kingdoms? How did we come to believe in gods, nations, and human rights? Sapiens takes readers on a sweeping tour through our entire history.',
            categories: ['Non-Fiction', 'History', 'Science'],
            spineColor: '#4169E1',
            textColor: '#FFFFFF',
            reviews: [
                { name: 'HistoryBuff', rating: 5, text: 'Absolutely fascinating look at human history.' },
                { name: 'ScienceReader', rating: 5, text: 'Changes the way you see the world.' }
            ]
        },
        {
            id: 'sample-10',
            title: 'The Little Prince',
            author: 'Antoine de Saint-Exupéry',
            cover: 'https://covers.openlibrary.org/b/id/8507422-M.jpg',
            rating: 4.7,
            ratingCount: 4123,
            description: 'A young prince visits various planets in space, including Earth, and addresses themes of loneliness, friendship, love, and loss. Though marketed as a children\'s book, The Little Prince makes observations about life and human nature that are often complex.',
            categories: ['Classic', 'Philosophy', 'Children\'s'],
            spineColor: '#9370DB',
            textColor: '#FFFACD',
            reviews: [
                { name: 'DreamerReader', rating: 5, text: 'A timeless tale that speaks to all ages.' },
                { name: 'PhilosophyFan', rating: 5, text: '"What is essential is invisible to the eye."' }
            ]
        },
        {
            id: 'sample-11',
            title: 'Educated',
            author: 'Tara Westover',
            cover: 'https://covers.openlibrary.org/b/id/8479576-M.jpg',
            rating: 4.4,
            ratingCount: 3876,
            description: 'Born to survivalists in the mountains of Idaho, Tara Westover was seventeen the first time she set foot in a classroom. Her quest for knowledge transformed her, taking her over oceans and across continents, to Harvard and to Cambridge University.',
            categories: ['Memoir', 'Non-Fiction', 'Inspirational'],
            spineColor: '#2E8B57',
            textColor: '#F5F5F5',
            reviews: [
                { name: 'MemoirLover', rating: 5, text: 'An incredible story of resilience and determination.' },
                { name: 'Educator', rating: 4, text: 'Shows the transformative power of education.' }
            ]
        },
        {
            id: 'sample-12',
            title: 'The Alchemist',
            author: 'Paulo Coelho',
            cover: 'https://covers.openlibrary.org/b/id/8225261-M.jpg',
            rating: 4.3,
            ratingCount: 5124,
            description: 'Santiago, a young Andalusian shepherd, dreams of discovering a worldly treasure. His journey takes him across the deserts of Egypt, teaching him about destiny, love, and listening to his heart.',
            categories: ['Fiction', 'Adventure', 'Inspirational'],
            spineColor: '#DAA520',
            textColor: '#1C1C1C',
            reviews: [
                { name: 'DreamChaser', rating: 5, text: 'A beautiful and inspiring tale about following your dreams.' },
                { name: 'BookWorm99', rating: 4, text: 'Simple yet powerful storytelling with deep meaning.' }
            ]
        },
        {
            id: 'sample-13',
            title: 'Atomic Habits',
            author: 'James Clear',
            cover: 'https://covers.openlibrary.org/b/id/9251996-M.jpg',
            rating: 4.6,
            ratingCount: 8432,
            description: 'A practical guide to building good habits and breaking bad ones. James Clear explains how small daily improvements compound into remarkable long-term results.',
            categories: ['Self-Help', 'Productivity', 'Personal Development'],
            spineColor: '#2E8B57',
            textColor: '#FFFFFF',
            reviews: [
                { name: 'GrowthMindset', rating: 5, text: 'Life-changing insights on building sustainable habits.' },
                { name: 'FocusBuilder', rating: 4, text: 'Actionable advice backed by science and real examples.' }
            ]
        },
        {
            id: 'sample-14',
            title: 'Deep Work',
            author: 'Cal Newport',
            cover: 'https://covers.openlibrary.org/b/id/8370226-M.jpg',
            rating: 4.5,
            ratingCount: 6921,
            description: 'A powerful guide to mastering focused success in a distracted world. Cal Newport explains how cultivating deep, concentrated work can dramatically improve productivity and create meaningful results in professional and personal life.',
            categories: ['Productivity', 'Self-Improvement', 'Career Development'],
            spineColor: '#1E3A8A',
            textColor: '#FFFFFF',
            reviews: [
                { name: 'CodeMaster', rating: 5, text: 'A must-read for anyone serious about improving focus and output.' },
                { name: 'SilentAchiever', rating: 4, text: 'Great framework for eliminating distractions and building deep concentration.' }
            ]
        },
        {
            id: 'sample-15',
            title: 'The Psychology of Money',
            author: 'Morgan Housel',
            cover: 'https://covers.openlibrary.org/b/id/10521270-M.jpg',
            rating: 4.7,
            ratingCount: 11234,
            description: 'An insightful exploration of how people think about money and the behaviors that influence financial decisions. Morgan Housel shares timeless lessons on wealth, greed, and happiness through engaging real-world stories.',
            categories: ['Finance', 'Self-Development', 'Investing'],
            spineColor: '#8B4513',
            textColor: '#FFFFFF',
            reviews: [
                { name: 'SmartInvestor', rating: 5, text: 'A refreshing perspective on wealth and financial behavior.' },
                { name: 'WealthBuilder', rating: 4, text: 'Simple yet powerful lessons that change how you view money.' }
            ]
        }
    ]
};

