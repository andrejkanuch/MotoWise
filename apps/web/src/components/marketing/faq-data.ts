export const FAQ_DATA = [
  {
    question: 'What is MotoWise?',
    answer:
      'MotoWise is an AI-powered platform designed for motorcycle enthusiasts. It helps you learn maintenance, diagnose issues using photo-based AI analysis, track your bikes in a digital garage, and build your knowledge through structured courses and quizzes.',
  },
  {
    question: 'Is MotoWise free?',
    answer:
      'Yes! MotoWise offers a free tier that includes basic learning content, one bike in your garage, and limited AI diagnostics. For unlimited diagnostics, all learning content, and unlimited bikes, you can upgrade to MotoWise Pro within the app.',
  },
  {
    question: 'What motorcycles are supported?',
    answer:
      'MotoWise supports all motorcycle makes and models. Our database uses the official NHTSA vehicle data, covering thousands of makes and models across all years. Simply search for your bike when adding it to your garage.',
  },
  {
    question: 'How does AI diagnostics work?',
    answer:
      'Take a photo of any part of your motorcycle and describe the issue. Our AI analyzes the image and provides a diagnostic assessment with severity ratings — from critical issues that need immediate attention to minor maintenance suggestions.',
  },
  {
    question: 'Is my data safe?',
    answer:
      'Absolutely. MotoWise uses Supabase with row-level security to protect your data. Authentication tokens are stored securely, and we never share your personal information or bike data with third parties.',
  },
  {
    question: "What's included in MotoWise Pro?",
    answer:
      'MotoWise Pro unlocks unlimited AI diagnostics, access to all learning modules and courses, unlimited bikes in your garage, priority support, and exclusive content. You can subscribe monthly or yearly from within the app.',
  },
] as const;
