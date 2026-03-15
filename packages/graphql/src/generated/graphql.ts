/* eslint-disable */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSON: { input: Record<string, unknown>; output: Record<string, unknown>; }
};

export type AddTaskPhotoInput = {
  fileSizeBytes?: InputMaybe<Scalars['Int']['input']>;
  storagePath: Scalars['String']['input'];
  taskId: Scalars['String']['input'];
};

export type AiBudgetStatus = {
  __typename?: 'AiBudgetStatus';
  circuitBreakerOpen: Scalars['Boolean']['output'];
  dailySpendCapCents: Scalars['Int']['output'];
  todayGenerationCount: Scalars['Int']['output'];
  todaySpendCents: Scalars['Int']['output'];
};

export type Article = {
  __typename?: 'Article';
  category: ArticleCategory;
  contentJson?: Maybe<Scalars['JSON']['output']>;
  difficulty: ArticleDifficulty;
  generatedAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isSafetyCritical: Scalars['Boolean']['output'];
  keywords?: Maybe<Array<Scalars['String']['output']>>;
  readTime?: Maybe<Scalars['Int']['output']>;
  slug: Scalars['String']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  viewCount: Scalars['Int']['output'];
};

export enum ArticleCategory {
  Brakes = 'brakes',
  Drivetrain = 'drivetrain',
  Electrical = 'electrical',
  Engine = 'engine',
  Fuel = 'fuel',
  General = 'general',
  Suspension = 'suspension',
  Tires = 'tires'
}

export type ArticleConnection = {
  __typename?: 'ArticleConnection';
  edges: Array<ArticleEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export enum ArticleDifficulty {
  Advanced = 'advanced',
  Beginner = 'beginner',
  Intermediate = 'intermediate'
}

export type ArticleEdge = {
  __typename?: 'ArticleEdge';
  cursor: Scalars['String']['output'];
  node: Article;
};

export type CompleteMaintenanceTaskInput = {
  completedMileage?: InputMaybe<Scalars['Int']['input']>;
  cost?: InputMaybe<Scalars['Float']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  laborCost?: InputMaybe<Scalars['Float']['input']>;
  partsCost?: InputMaybe<Scalars['Float']['input']>;
};

export type CompleteOnboardingInput = {
  annualRepairSpend?: InputMaybe<Scalars['String']['input']>;
  bikeMake?: InputMaybe<Scalars['String']['input']>;
  bikeMileage?: InputMaybe<Scalars['Int']['input']>;
  bikeMileageUnit?: InputMaybe<Scalars['String']['input']>;
  bikeModel?: InputMaybe<Scalars['String']['input']>;
  bikeNickname?: InputMaybe<Scalars['String']['input']>;
  bikePhotoUrl?: InputMaybe<Scalars['String']['input']>;
  bikeType?: InputMaybe<Scalars['String']['input']>;
  bikeYear?: InputMaybe<Scalars['Int']['input']>;
  experienceLevel: Scalars['String']['input'];
  lastServiceDate?: InputMaybe<Scalars['String']['input']>;
  learningFormats: Array<Scalars['String']['input']>;
  maintenanceReminders?: InputMaybe<Scalars['Boolean']['input']>;
  maintenanceStyle?: InputMaybe<Scalars['String']['input']>;
  recallAlerts?: InputMaybe<Scalars['Boolean']['input']>;
  reminderChannel?: InputMaybe<Scalars['String']['input']>;
  ridingFrequency?: InputMaybe<Scalars['String']['input']>;
  ridingGoals: Array<Scalars['String']['input']>;
  seasonalTips?: InputMaybe<Scalars['Boolean']['input']>;
  weeklySummary?: InputMaybe<Scalars['Boolean']['input']>;
};

export type CompleteTaskResult = {
  __typename?: 'CompleteTaskResult';
  /** The task that was marked as completed */
  completed: MaintenanceTask;
  /** The next occurrence if recurring and user opted in, null otherwise */
  nextOccurrence?: Maybe<MaintenanceTask>;
};

export type ContentFlag = {
  __typename?: 'ContentFlag';
  articleId: Scalars['String']['output'];
  comment: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  sectionReference?: Maybe<Scalars['String']['output']>;
  status: FlagStatus;
  userId: Scalars['String']['output'];
};

export type CreateDiagnosticInput = {
  dataSharingOptedIn?: Scalars['Boolean']['input'];
  motorcycleId?: InputMaybe<Scalars['String']['input']>;
  wizardAnswers?: InputMaybe<Scalars['JSON']['input']>;
};

export type CreateFlagInput = {
  articleId: Scalars['String']['input'];
  comment: Scalars['String']['input'];
  sectionReference?: InputMaybe<Scalars['String']['input']>;
};

export type CreateMaintenanceTaskInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  dueDate?: InputMaybe<Scalars['String']['input']>;
  motorcycleId: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  partsNeeded?: InputMaybe<Array<Scalars['String']['input']>>;
  priority?: InputMaybe<MaintenancePriority>;
  targetMileage?: InputMaybe<Scalars['Int']['input']>;
  title: Scalars['String']['input'];
};

export type CreateMotorcycleInput = {
  make: Scalars['String']['input'];
  model: Scalars['String']['input'];
  nickname?: InputMaybe<Scalars['String']['input']>;
  year: Scalars['Int']['input'];
};

export type CreateShareLinkInput = {
  expiresInDays?: InputMaybe<Scalars['Int']['input']>;
  motorcycleId: Scalars['String']['input'];
};

export type DataExportRequest = {
  __typename?: 'DataExportRequest';
  completedAt?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  requestedAt: Scalars['String']['output'];
  status: Scalars['String']['output'];
  userId: Scalars['String']['output'];
};

export type Diagnostic = {
  __typename?: 'Diagnostic';
  confidence?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['String']['output'];
  dataSharingOptedIn: Scalars['Boolean']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  motorcycleId?: Maybe<Scalars['String']['output']>;
  photoUrl?: Maybe<Scalars['String']['output']>;
  relatedArticleId?: Maybe<Scalars['String']['output']>;
  resultJson?: Maybe<Scalars['JSON']['output']>;
  severity?: Maybe<DiagnosticSeverity>;
  status: Scalars['String']['output'];
  urgency?: Maybe<Urgency>;
  userId: Scalars['String']['output'];
};

export enum DiagnosticSeverity {
  Critical = 'critical',
  High = 'high',
  Low = 'low',
  Medium = 'medium'
}

export type Expense = {
  __typename?: 'Expense';
  amount: Scalars['Float']['output'];
  category: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  date: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  maintenanceTaskId?: Maybe<Scalars['String']['output']>;
  motorcycleId: Scalars['String']['output'];
};

export type ExpenseCategory = {
  __typename?: 'ExpenseCategory';
  category: Scalars['String']['output'];
  expenses: Array<Expense>;
  total: Scalars['Float']['output'];
};

export type ExpenseSummary = {
  __typename?: 'ExpenseSummary';
  categories: Array<ExpenseCategory>;
  ytdTotal: Scalars['Float']['output'];
};

export enum FlagStatus {
  Dismissed = 'dismissed',
  Pending = 'pending',
  Resolved = 'resolved',
  Reviewed = 'reviewed'
}

export type GenerateArticleInput = {
  category?: InputMaybe<ArticleCategory>;
  difficulty?: InputMaybe<ArticleDifficulty>;
  topic: Scalars['String']['input'];
};

export type GenerateInsightsInput = {
  bikeMake?: InputMaybe<Scalars['String']['input']>;
  bikeModel?: InputMaybe<Scalars['String']['input']>;
  bikeType?: InputMaybe<Scalars['String']['input']>;
  bikeYear?: InputMaybe<Scalars['Int']['input']>;
  currentMileage?: InputMaybe<Scalars['Int']['input']>;
  experienceLevel: Scalars['String']['input'];
  maintenanceStyle?: InputMaybe<Scalars['String']['input']>;
  ridingFrequency?: InputMaybe<Scalars['String']['input']>;
};

export enum InsightType {
  Community = 'community',
  Learning = 'learning',
  Maintenance = 'maintenance'
}

export type LearningProgress = {
  __typename?: 'LearningProgress';
  articleId: Scalars['String']['output'];
  articleRead: Scalars['Boolean']['output'];
  firstReadAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  lastReadAt?: Maybe<Scalars['String']['output']>;
  quizBestScore?: Maybe<Scalars['Int']['output']>;
  quizCompleted: Scalars['Boolean']['output'];
  userId: Scalars['String']['output'];
};

export type LogExpenseInput = {
  amount: Scalars['Float']['input'];
  category: Scalars['String']['input'];
  date: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  motorcycleId: Scalars['String']['input'];
};

export enum MaintenancePriority {
  Critical = 'critical',
  High = 'high',
  Low = 'low',
  Medium = 'medium'
}

export type MaintenanceTask = {
  __typename?: 'MaintenanceTask';
  completedAt?: Maybe<Scalars['String']['output']>;
  completedMileage?: Maybe<Scalars['Int']['output']>;
  cost?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['String']['output'];
  currency?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  dueDate?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  intervalDays?: Maybe<Scalars['Int']['output']>;
  intervalKm?: Maybe<Scalars['Int']['output']>;
  isRecurring: Scalars['Boolean']['output'];
  laborCost?: Maybe<Scalars['Float']['output']>;
  motorcycleId: Scalars['String']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  oemScheduleId?: Maybe<Scalars['String']['output']>;
  partsCost?: Maybe<Scalars['Float']['output']>;
  partsNeeded?: Maybe<Array<Scalars['String']['output']>>;
  photos: Array<TaskPhoto>;
  priority: MaintenancePriority;
  source: MaintenanceTaskSource;
  status: MaintenanceTaskStatus;
  targetMileage?: Maybe<Scalars['Int']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  userId: Scalars['String']['output'];
};

export enum MaintenanceTaskSource {
  Imported = 'imported',
  Oem = 'oem',
  User = 'user'
}

export enum MaintenanceTaskStatus {
  Completed = 'completed',
  InProgress = 'in_progress',
  Pending = 'pending',
  Skipped = 'skipped'
}

export type ManualBikeInfoInput = {
  make?: InputMaybe<Scalars['String']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  type: MotorcycleType;
  year?: InputMaybe<Scalars['Int']['input']>;
};

export type Motorcycle = {
  __typename?: 'Motorcycle';
  createdAt: Scalars['String']['output'];
  currentMileage?: Maybe<Scalars['Int']['output']>;
  engineCc?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  isPrimary: Scalars['Boolean']['output'];
  make: Scalars['String']['output'];
  mileageUnit?: Maybe<Scalars['String']['output']>;
  mileageUpdatedAt?: Maybe<Scalars['String']['output']>;
  model: Scalars['String']['output'];
  nickname?: Maybe<Scalars['String']['output']>;
  primaryPhotoUrl?: Maybe<Scalars['String']['output']>;
  type?: Maybe<MotorcycleType>;
  userId: Scalars['String']['output'];
  year: Scalars['Int']['output'];
};

export type MotorcycleMake = {
  __typename?: 'MotorcycleMake';
  isPopular: Scalars['Boolean']['output'];
  makeId: Scalars['Int']['output'];
  makeName: Scalars['String']['output'];
};

export type MotorcycleModelResult = {
  __typename?: 'MotorcycleModelResult';
  modelId: Scalars['Int']['output'];
  modelName: Scalars['String']['output'];
};

/** Type/category of motorcycle */
export enum MotorcycleType {
  Cruiser = 'cruiser',
  DirtBike = 'dirt_bike',
  DualSport = 'dual_sport',
  Other = 'other',
  Scooter = 'scooter',
  Sportbike = 'sportbike',
  Standard = 'standard',
  Touring = 'touring'
}

export type Mutation = {
  __typename?: 'Mutation';
  addTaskPhoto: TaskPhoto;
  completeMaintenanceTask: CompleteTaskResult;
  completeOnboarding: User;
  createDiagnostic: Diagnostic;
  createFlag: ContentFlag;
  createMaintenanceTask: MaintenanceTask;
  createMotorcycle: Motorcycle;
  createShareLink: ShareLink;
  deleteAccount: Scalars['Boolean']['output'];
  deleteExpense: Scalars['Boolean']['output'];
  deleteMaintenanceTask: Scalars['Boolean']['output'];
  deleteMotorcycle: Scalars['Boolean']['output'];
  deleteTaskPhoto: Scalars['Boolean']['output'];
  generateArticle: Article;
  generateOnboardingInsights: Array<OnboardingInsight>;
  /** Submit email to join waitlist (public, no auth) */
  joinWaitlist: Scalars['Boolean']['output'];
  logExpense: Expense;
  markArticleRead: LearningProgress;
  requestDataExport: DataExportRequest;
  resetAiCircuitBreaker: Scalars['Boolean']['output'];
  revokeShareLink: Scalars['Boolean']['output'];
  submitDiagnostic: Diagnostic;
  submitQuiz: QuizAttempt;
  updateMaintenanceTask: MaintenanceTask;
  updateMotorcycle: Motorcycle;
  updateUser: User;
};


export type MutationAddTaskPhotoArgs = {
  input: AddTaskPhotoInput;
};


export type MutationCompleteMaintenanceTaskArgs = {
  createNextOccurrence?: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['String']['input'];
  input?: InputMaybe<CompleteMaintenanceTaskInput>;
};


export type MutationCompleteOnboardingArgs = {
  input: CompleteOnboardingInput;
};


export type MutationCreateDiagnosticArgs = {
  input: CreateDiagnosticInput;
};


export type MutationCreateFlagArgs = {
  input: CreateFlagInput;
};


export type MutationCreateMaintenanceTaskArgs = {
  input: CreateMaintenanceTaskInput;
};


export type MutationCreateMotorcycleArgs = {
  input: CreateMotorcycleInput;
};


export type MutationCreateShareLinkArgs = {
  input: CreateShareLinkInput;
};


export type MutationDeleteExpenseArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteMaintenanceTaskArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteMotorcycleArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteTaskPhotoArgs = {
  photoId: Scalars['ID']['input'];
};


export type MutationGenerateArticleArgs = {
  input: GenerateArticleInput;
};


export type MutationGenerateOnboardingInsightsArgs = {
  input: GenerateInsightsInput;
};


export type MutationJoinWaitlistArgs = {
  email: Scalars['String']['input'];
};


export type MutationLogExpenseArgs = {
  input: LogExpenseInput;
};


export type MutationMarkArticleReadArgs = {
  articleId: Scalars['String']['input'];
};


export type MutationRevokeShareLinkArgs = {
  linkId: Scalars['ID']['input'];
};


export type MutationSubmitDiagnosticArgs = {
  input: SubmitDiagnosticInput;
};


export type MutationSubmitQuizArgs = {
  input: SubmitQuizInput;
};


export type MutationUpdateMaintenanceTaskArgs = {
  id: Scalars['String']['input'];
  input: UpdateMaintenanceTaskInput;
};


export type MutationUpdateMotorcycleArgs = {
  id: Scalars['String']['input'];
  input: UpdateMotorcycleInput;
};


export type MutationUpdateUserArgs = {
  input: UpdateUserInput;
};

export type OemSchedule = {
  __typename?: 'OemSchedule';
  createdAt: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  engineCcMax?: Maybe<Scalars['Int']['output']>;
  engineCcMin?: Maybe<Scalars['Int']['output']>;
  engineType?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  intervalDays?: Maybe<Scalars['Int']['output']>;
  intervalKm?: Maybe<Scalars['Int']['output']>;
  make: Scalars['String']['output'];
  model?: Maybe<Scalars['String']['output']>;
  priority: MaintenancePriority;
  sortOrder: Scalars['Int']['output'];
  taskName: Scalars['String']['output'];
  yearFrom?: Maybe<Scalars['Int']['output']>;
  yearTo?: Maybe<Scalars['Int']['output']>;
};

export type OnboardingInsight = {
  __typename?: 'OnboardingInsight';
  body: Scalars['String']['output'];
  icon: Scalars['String']['output'];
  title: Scalars['String']['output'];
  type: InsightType;
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['String']['output']>;
};

export type Query = {
  __typename?: 'Query';
  aiBudgetStatus: AiBudgetStatus;
  allMaintenanceTasks: Array<MaintenanceTask>;
  articleBySlug?: Maybe<Article>;
  articleBySlugFull?: Maybe<Article>;
  diagnosticById?: Maybe<Diagnostic>;
  expenses: ExpenseSummary;
  maintenanceTaskHistory: Array<MaintenanceTask>;
  maintenanceTasks: Array<MaintenanceTask>;
  me: User;
  motorcycleMakes: Array<MotorcycleMake>;
  motorcycleModels: Array<MotorcycleModelResult>;
  myDiagnostics: Array<Diagnostic>;
  myMotorcycles: Array<Motorcycle>;
  myProgress: Array<LearningProgress>;
  myShareLinks: Array<ShareLink>;
  oemSchedulesForBike: Array<OemSchedule>;
  popularArticles: Array<Article>;
  quizByArticle?: Maybe<Quiz>;
  searchArticles: ArticleConnection;
  sharedBikeHistory: SharedBikeHistory;
  spendingSummary: SpendingSummary;
  user: User;
};


export type QueryArticleBySlugArgs = {
  slug: Scalars['String']['input'];
};


export type QueryArticleBySlugFullArgs = {
  slug: Scalars['String']['input'];
};


export type QueryDiagnosticByIdArgs = {
  id: Scalars['String']['input'];
};


export type QueryExpensesArgs = {
  motorcycleId: Scalars['String']['input'];
  year?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryMaintenanceTaskHistoryArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  motorcycleId: Scalars['String']['input'];
};


export type QueryMaintenanceTasksArgs = {
  motorcycleId: Scalars['String']['input'];
};


export type QueryMotorcycleModelsArgs = {
  makeId: Scalars['Int']['input'];
  year: Scalars['Int']['input'];
};


export type QueryMyShareLinksArgs = {
  motorcycleId: Scalars['ID']['input'];
};


export type QueryOemSchedulesForBikeArgs = {
  motorcycleId: Scalars['String']['input'];
};


export type QueryPopularArticlesArgs = {
  first?: Scalars['Int']['input'];
};


export type QueryQuizByArticleArgs = {
  articleId: Scalars['String']['input'];
};


export type QuerySearchArticlesArgs = {
  input: SearchArticlesInput;
};


export type QuerySharedBikeHistoryArgs = {
  token: Scalars['String']['input'];
};


export type QuerySpendingSummaryArgs = {
  motorcycleId: Scalars['String']['input'];
};

export type Quiz = {
  __typename?: 'Quiz';
  articleId: Scalars['String']['output'];
  generatedAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  questions: Array<QuizQuestion>;
};

export type QuizAttempt = {
  __typename?: 'QuizAttempt';
  completedAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  quizId: Scalars['String']['output'];
  score: Scalars['Float']['output'];
  totalQuestions: Scalars['Float']['output'];
};

export type QuizQuestion = {
  __typename?: 'QuizQuestion';
  explanation: Scalars['String']['output'];
  options: Array<Scalars['String']['output']>;
  question: Scalars['String']['output'];
};

export type SearchArticlesInput = {
  after?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<ArticleCategory>;
  difficulty?: InputMaybe<ArticleDifficulty>;
  first?: InputMaybe<Scalars['Int']['input']>;
  query?: InputMaybe<Scalars['String']['input']>;
};

export type ShareLink = {
  __typename?: 'ShareLink';
  createdAt: Scalars['String']['output'];
  expiresAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  motorcycleId: Scalars['String']['output'];
  token: Scalars['String']['output'];
  url: Scalars['String']['output'];
};

export type SharedBikeHistory = {
  __typename?: 'SharedBikeHistory';
  bike: SharedBikeInfo;
  generatedAt: Scalars['String']['output'];
  tasks: Array<SharedTaskInfo>;
};

export type SharedBikeInfo = {
  __typename?: 'SharedBikeInfo';
  make: Scalars['String']['output'];
  model: Scalars['String']['output'];
  nickname?: Maybe<Scalars['String']['output']>;
  year: Scalars['Int']['output'];
};

export type SharedTaskInfo = {
  __typename?: 'SharedTaskInfo';
  completedAt?: Maybe<Scalars['String']['output']>;
  completedMileage?: Maybe<Scalars['Int']['output']>;
  dueDate?: Maybe<Scalars['String']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  photoUrls: Array<Scalars['String']['output']>;
  priority: Scalars['String']['output'];
  status: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type SpendingSummary = {
  __typename?: 'SpendingSummary';
  allTime: Scalars['Float']['output'];
  thisYear: Scalars['Float']['output'];
};

export type SubmitDiagnosticInput = {
  additionalNotes?: InputMaybe<Scalars['String']['input']>;
  dataSharingOptedIn?: Scalars['Boolean']['input'];
  freeTextDescription?: InputMaybe<Scalars['String']['input']>;
  manualBikeInfo?: InputMaybe<ManualBikeInfoInput>;
  motorcycleId?: InputMaybe<Scalars['String']['input']>;
  photoBase64?: InputMaybe<Scalars['String']['input']>;
  urgency?: InputMaybe<Urgency>;
  wizardAnswers?: InputMaybe<Scalars['JSON']['input']>;
};

export type SubmitQuizInput = {
  answers: Array<Scalars['Int']['input']>;
  quizId: Scalars['String']['input'];
};

export type TaskPhoto = {
  __typename?: 'TaskPhoto';
  createdAt: Scalars['String']['output'];
  fileSizeBytes?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  mimeType: Scalars['String']['output'];
  publicUrl: Scalars['String']['output'];
  storagePath: Scalars['String']['output'];
  taskId: Scalars['String']['output'];
};

export type UpdateMaintenanceTaskInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  dueDate?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  partsNeeded?: InputMaybe<Array<Scalars['String']['input']>>;
  priority?: InputMaybe<MaintenancePriority>;
  targetMileage?: InputMaybe<Scalars['Int']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateMotorcycleInput = {
  currentMileage?: InputMaybe<Scalars['Int']['input']>;
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  make?: InputMaybe<Scalars['String']['input']>;
  mileageUnit?: InputMaybe<Scalars['String']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  nickname?: InputMaybe<Scalars['String']['input']>;
  primaryPhotoUrl?: InputMaybe<Scalars['String']['input']>;
  year?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateUserInput = {
  fullName?: InputMaybe<Scalars['String']['input']>;
  preferences?: InputMaybe<Scalars['JSON']['input']>;
};

/** User-reported urgency level for diagnostic requests */
export enum Urgency {
  Preventive = 'preventive',
  Soon = 'soon',
  Stranded = 'stranded'
}

export type User = {
  __typename?: 'User';
  createdAt: Scalars['String']['output'];
  email: Scalars['String']['output'];
  fullName?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  preferences?: Maybe<Scalars['JSON']['output']>;
  role: UserRole;
  subscriptionTier?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['String']['output'];
};

export enum UserRole {
  Admin = 'admin',
  User = 'user'
}

export type AddTaskPhotoMutationVariables = Exact<{
  input: AddTaskPhotoInput;
}>;


export type AddTaskPhotoMutation = { __typename?: 'Mutation', addTaskPhoto: { __typename?: 'TaskPhoto', id: string, taskId: string, storagePath: string, publicUrl: string, fileSizeBytes?: number | null, mimeType: string, createdAt: string } };

export type CompleteMaintenanceTaskMutationVariables = Exact<{
  id: Scalars['String']['input'];
  input?: InputMaybe<CompleteMaintenanceTaskInput>;
  createNextOccurrence?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type CompleteMaintenanceTaskMutation = { __typename?: 'Mutation', completeMaintenanceTask: { __typename?: 'CompleteTaskResult', completed: { __typename?: 'MaintenanceTask', id: string, status: MaintenanceTaskStatus, completedAt?: string | null, completedMileage?: number | null, cost?: number | null, partsCost?: number | null, laborCost?: number | null, currency?: string | null }, nextOccurrence?: { __typename?: 'MaintenanceTask', id: string, title: string, description?: string | null, dueDate?: string | null, targetMileage?: number | null, priority: MaintenancePriority, status: MaintenanceTaskStatus, isRecurring: boolean, intervalKm?: number | null, intervalDays?: number | null, source: MaintenanceTaskSource, motorcycleId: string, createdAt: string } | null } };

export type CompleteOnboardingMutationVariables = Exact<{
  input: CompleteOnboardingInput;
}>;


export type CompleteOnboardingMutation = { __typename?: 'Mutation', completeOnboarding: { __typename?: 'User', id: string, preferences?: Record<string, unknown> | null, createdAt: string, updatedAt: string } };

export type CreateDiagnosticMutationVariables = Exact<{
  input: CreateDiagnosticInput;
}>;


export type CreateDiagnosticMutation = { __typename?: 'Mutation', createDiagnostic: { __typename?: 'Diagnostic', id: string, userId: string, motorcycleId?: string | null, severity?: DiagnosticSeverity | null, confidence?: number | null, relatedArticleId?: string | null, status: string, dataSharingOptedIn: boolean, createdAt: string } };

export type CreateFlagMutationVariables = Exact<{
  input: CreateFlagInput;
}>;


export type CreateFlagMutation = { __typename?: 'Mutation', createFlag: { __typename?: 'ContentFlag', id: string, articleId: string, userId: string, sectionReference?: string | null, comment: string, status: FlagStatus, createdAt: string } };

export type CreateMaintenanceTaskMutationVariables = Exact<{
  input: CreateMaintenanceTaskInput;
}>;


export type CreateMaintenanceTaskMutation = { __typename?: 'Mutation', createMaintenanceTask: { __typename?: 'MaintenanceTask', id: string, title: string, priority: MaintenancePriority, status: MaintenanceTaskStatus, dueDate?: string | null, targetMileage?: number | null, createdAt: string } };

export type CreateMotorcycleMutationVariables = Exact<{
  input: CreateMotorcycleInput;
}>;


export type CreateMotorcycleMutation = { __typename?: 'Mutation', createMotorcycle: { __typename?: 'Motorcycle', id: string, make: string, model: string, year: number, nickname?: string | null, isPrimary: boolean, createdAt: string } };

export type CreateQuizAttemptMutationVariables = Exact<{
  input: SubmitQuizInput;
}>;


export type CreateQuizAttemptMutation = { __typename?: 'Mutation', submitQuiz: { __typename?: 'QuizAttempt', id: string, quizId: string, score: number, totalQuestions: number, completedAt: string } };

export type CreateShareLinkMutationVariables = Exact<{
  input: CreateShareLinkInput;
}>;


export type CreateShareLinkMutation = { __typename?: 'Mutation', createShareLink: { __typename?: 'ShareLink', id: string, token: string, motorcycleId: string, expiresAt: string, createdAt: string, url: string } };

export type DeleteAccountMutationVariables = Exact<{ [key: string]: never; }>;


export type DeleteAccountMutation = { __typename?: 'Mutation', deleteAccount: boolean };

export type DeleteExpenseMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteExpenseMutation = { __typename?: 'Mutation', deleteExpense: boolean };

export type DeleteMaintenanceTaskMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteMaintenanceTaskMutation = { __typename?: 'Mutation', deleteMaintenanceTask: boolean };

export type DeleteMotorcycleMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteMotorcycleMutation = { __typename?: 'Mutation', deleteMotorcycle: boolean };

export type DeleteTaskPhotoMutationVariables = Exact<{
  photoId: Scalars['ID']['input'];
}>;


export type DeleteTaskPhotoMutation = { __typename?: 'Mutation', deleteTaskPhoto: boolean };

export type GenerateArticleMutationVariables = Exact<{
  input: GenerateArticleInput;
}>;


export type GenerateArticleMutation = { __typename?: 'Mutation', generateArticle: { __typename?: 'Article', id: string, slug: string, title: string, difficulty: ArticleDifficulty, category: ArticleCategory, contentJson?: Record<string, unknown> | null, readTime?: number | null, generatedAt: string } };

export type GenerateOnboardingInsightsMutationVariables = Exact<{
  input: GenerateInsightsInput;
}>;


export type GenerateOnboardingInsightsMutation = { __typename?: 'Mutation', generateOnboardingInsights: Array<{ __typename?: 'OnboardingInsight', icon: string, title: string, body: string, type: InsightType }> };

export type LogExpenseMutationVariables = Exact<{
  input: LogExpenseInput;
}>;


export type LogExpenseMutation = { __typename?: 'Mutation', logExpense: { __typename?: 'Expense', id: string, amount: number, category: string, description?: string | null, date: string, createdAt: string } };

export type MarkArticleReadMutationVariables = Exact<{
  articleId: Scalars['String']['input'];
}>;


export type MarkArticleReadMutation = { __typename?: 'Mutation', markArticleRead: { __typename?: 'LearningProgress', id: string, userId: string, articleId: string, articleRead: boolean, quizCompleted: boolean, quizBestScore?: number | null, firstReadAt?: string | null, lastReadAt?: string | null } };

export type RequestDataExportMutationVariables = Exact<{ [key: string]: never; }>;


export type RequestDataExportMutation = { __typename?: 'Mutation', requestDataExport: { __typename?: 'DataExportRequest', id: string, status: string, requestedAt: string } };

export type RevokeShareLinkMutationVariables = Exact<{
  linkId: Scalars['ID']['input'];
}>;


export type RevokeShareLinkMutation = { __typename?: 'Mutation', revokeShareLink: boolean };

export type SubmitDiagnosticMutationVariables = Exact<{
  input: SubmitDiagnosticInput;
}>;


export type SubmitDiagnosticMutation = { __typename?: 'Mutation', submitDiagnostic: { __typename?: 'Diagnostic', id: string, userId: string, motorcycleId?: string | null, severity?: DiagnosticSeverity | null, confidence?: number | null, relatedArticleId?: string | null, resultJson?: Record<string, unknown> | null, description?: string | null, photoUrl?: string | null, status: string, createdAt: string } };

export type UpdateMotorcycleMutationVariables = Exact<{
  id: Scalars['String']['input'];
  input: UpdateMotorcycleInput;
}>;


export type UpdateMotorcycleMutation = { __typename?: 'Mutation', updateMotorcycle: { __typename?: 'Motorcycle', id: string, make: string, model: string, year: number, nickname?: string | null, isPrimary: boolean, primaryPhotoUrl?: string | null, currentMileage?: number | null, mileageUnit?: string | null, mileageUpdatedAt?: string | null } };

export type UpdateUserMutationVariables = Exact<{
  input: UpdateUserInput;
}>;


export type UpdateUserMutation = { __typename?: 'Mutation', updateUser: { __typename?: 'User', id: string, fullName?: string | null, preferences?: Record<string, unknown> | null } };

export type AllMaintenanceTasksQueryVariables = Exact<{ [key: string]: never; }>;


export type AllMaintenanceTasksQuery = { __typename?: 'Query', allMaintenanceTasks: Array<{ __typename?: 'MaintenanceTask', id: string, motorcycleId: string, title: string, dueDate?: string | null, targetMileage?: number | null, priority: MaintenancePriority, status: MaintenanceTaskStatus, completedAt?: string | null }> };

export type ArticleBySlugFullQueryVariables = Exact<{
  slug: Scalars['String']['input'];
}>;


export type ArticleBySlugFullQuery = { __typename?: 'Query', articleBySlugFull?: { __typename?: 'Article', id: string, slug: string, title: string, difficulty: ArticleDifficulty, category: ArticleCategory, viewCount: number, isSafetyCritical: boolean, contentJson?: Record<string, unknown> | null, readTime?: number | null, generatedAt: string, updatedAt: string } | null };

export type DiagnosticByIdQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DiagnosticByIdQuery = { __typename?: 'Query', diagnosticById?: { __typename?: 'Diagnostic', id: string, userId: string, motorcycleId?: string | null, severity?: DiagnosticSeverity | null, confidence?: number | null, relatedArticleId?: string | null, resultJson?: Record<string, unknown> | null, description?: string | null, photoUrl?: string | null, status: string, dataSharingOptedIn: boolean, createdAt: string } | null };

export type ExpensesByMotorcycleQueryVariables = Exact<{
  motorcycleId: Scalars['String']['input'];
  year: Scalars['Int']['input'];
}>;


export type ExpensesByMotorcycleQuery = { __typename?: 'Query', expenses: { __typename?: 'ExpenseSummary', ytdTotal: number, categories: Array<{ __typename?: 'ExpenseCategory', category: string, total: number, expenses: Array<{ __typename?: 'Expense', id: string, amount: number, category: string, description?: string | null, date: string, createdAt: string }> }> } };

export type GetArticleBySlugQueryVariables = Exact<{
  slug: Scalars['String']['input'];
}>;


export type GetArticleBySlugQuery = { __typename?: 'Query', articleBySlug?: { __typename?: 'Article', id: string, slug: string, title: string, difficulty: ArticleDifficulty, category: ArticleCategory, viewCount: number, isSafetyCritical: boolean, generatedAt: string, updatedAt: string } | null };

export type GetQuizByArticleQueryVariables = Exact<{
  articleId: Scalars['String']['input'];
}>;


export type GetQuizByArticleQuery = { __typename?: 'Query', quizByArticle?: { __typename?: 'Quiz', id: string, articleId: string, generatedAt: string, questions: Array<{ __typename?: 'QuizQuestion', question: string, options: Array<string>, explanation: string }> } | null };

export type ListPopularArticlesQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
}>;


export type ListPopularArticlesQuery = { __typename?: 'Query', popularArticles: Array<{ __typename?: 'Article', id: string, slug: string, title: string, difficulty: ArticleDifficulty, category: ArticleCategory, viewCount: number, isSafetyCritical: boolean, generatedAt: string, readTime?: number | null, keywords?: Array<string> | null }> };

export type MaintenanceTaskHistoryQueryVariables = Exact<{
  motorcycleId: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type MaintenanceTaskHistoryQuery = { __typename?: 'Query', maintenanceTaskHistory: Array<{ __typename?: 'MaintenanceTask', id: string, userId: string, motorcycleId: string, title: string, description?: string | null, dueDate?: string | null, targetMileage?: number | null, priority: MaintenancePriority, status: MaintenanceTaskStatus, notes?: string | null, partsNeeded?: Array<string> | null, completedAt?: string | null, completedMileage?: number | null, source: MaintenanceTaskSource, oemScheduleId?: string | null, intervalKm?: number | null, intervalDays?: number | null, isRecurring: boolean, createdAt: string, updatedAt: string }> };

export type MaintenanceTasksByMotorcycleQueryVariables = Exact<{
  motorcycleId: Scalars['String']['input'];
}>;


export type MaintenanceTasksByMotorcycleQuery = { __typename?: 'Query', maintenanceTasks: Array<{ __typename?: 'MaintenanceTask', id: string, userId: string, motorcycleId: string, title: string, description?: string | null, dueDate?: string | null, targetMileage?: number | null, priority: MaintenancePriority, status: MaintenanceTaskStatus, notes?: string | null, partsNeeded?: Array<string> | null, completedAt?: string | null, completedMileage?: number | null, cost?: number | null, partsCost?: number | null, laborCost?: number | null, currency?: string | null, source: MaintenanceTaskSource, isRecurring: boolean, intervalKm?: number | null, intervalDays?: number | null, createdAt: string, updatedAt: string, photos: Array<{ __typename?: 'TaskPhoto', id: string, storagePath: string, publicUrl: string }> }> };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { __typename?: 'Query', me: { __typename?: 'User', id: string, email: string, fullName?: string | null, role: UserRole, preferences?: Record<string, unknown> | null, createdAt: string, updatedAt: string } };

export type MotorcycleMakesQueryVariables = Exact<{ [key: string]: never; }>;


export type MotorcycleMakesQuery = { __typename?: 'Query', motorcycleMakes: Array<{ __typename?: 'MotorcycleMake', makeId: number, makeName: string, isPopular: boolean }> };

export type MotorcycleModelsQueryVariables = Exact<{
  makeId: Scalars['Int']['input'];
  year: Scalars['Int']['input'];
}>;


export type MotorcycleModelsQuery = { __typename?: 'Query', motorcycleModels: Array<{ __typename?: 'MotorcycleModelResult', modelId: number, modelName: string }> };

export type MyDiagnosticsQueryVariables = Exact<{ [key: string]: never; }>;


export type MyDiagnosticsQuery = { __typename?: 'Query', myDiagnostics: Array<{ __typename?: 'Diagnostic', id: string, userId: string, motorcycleId?: string | null, severity?: DiagnosticSeverity | null, confidence?: number | null, relatedArticleId?: string | null, status: string, dataSharingOptedIn: boolean, createdAt: string }> };

export type MyMotorcyclesQueryVariables = Exact<{ [key: string]: never; }>;


export type MyMotorcyclesQuery = { __typename?: 'Query', myMotorcycles: Array<{ __typename?: 'Motorcycle', id: string, userId: string, make: string, model: string, year: number, nickname?: string | null, isPrimary: boolean, primaryPhotoUrl?: string | null, currentMileage?: number | null, mileageUnit?: string | null, mileageUpdatedAt?: string | null, createdAt: string }> };

export type MyProgressQueryVariables = Exact<{ [key: string]: never; }>;


export type MyProgressQuery = { __typename?: 'Query', myProgress: Array<{ __typename?: 'LearningProgress', id: string, userId: string, articleId: string, articleRead: boolean, quizCompleted: boolean, quizBestScore?: number | null, firstReadAt?: string | null, lastReadAt?: string | null }> };

export type MyShareLinksQueryVariables = Exact<{
  motorcycleId: Scalars['ID']['input'];
}>;


export type MyShareLinksQuery = { __typename?: 'Query', myShareLinks: Array<{ __typename?: 'ShareLink', id: string, token: string, motorcycleId: string, expiresAt: string, createdAt: string, url: string }> };

export type SearchArticlesQueryVariables = Exact<{
  input: SearchArticlesInput;
}>;


export type SearchArticlesQuery = { __typename?: 'Query', searchArticles: { __typename?: 'ArticleConnection', totalCount: number, edges: Array<{ __typename?: 'ArticleEdge', cursor: string, node: { __typename?: 'Article', id: string, slug: string, title: string, difficulty: ArticleDifficulty, category: ArticleCategory, viewCount: number, isSafetyCritical: boolean, generatedAt: string, updatedAt: string, keywords?: Array<string> | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type SpendingSummaryQueryVariables = Exact<{
  motorcycleId: Scalars['String']['input'];
}>;


export type SpendingSummaryQuery = { __typename?: 'Query', spendingSummary: { __typename?: 'SpendingSummary', thisYear: number, allTime: number } };

export type JoinWaitlistMutationVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type JoinWaitlistMutation = { __typename?: 'Mutation', joinWaitlist: boolean };


export const AddTaskPhotoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddTaskPhoto"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddTaskPhotoInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addTaskPhoto"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"storagePath"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileSizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<AddTaskPhotoMutation, AddTaskPhotoMutationVariables>;
export const CompleteMaintenanceTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompleteMaintenanceTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"CompleteMaintenanceTaskInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"createNextOccurrence"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completeMaintenanceTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}},{"kind":"Argument","name":{"kind":"Name","value":"createNextOccurrence"},"value":{"kind":"Variable","name":{"kind":"Name","value":"createNextOccurrence"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completed"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedMileage"}},{"kind":"Field","name":{"kind":"Name","value":"cost"}},{"kind":"Field","name":{"kind":"Name","value":"partsCost"}},{"kind":"Field","name":{"kind":"Name","value":"laborCost"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nextOccurrence"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","name":{"kind":"Name","value":"targetMileage"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isRecurring"}},{"kind":"Field","name":{"kind":"Name","value":"intervalKm"}},{"kind":"Field","name":{"kind":"Name","value":"intervalDays"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]} as unknown as DocumentNode<CompleteMaintenanceTaskMutation, CompleteMaintenanceTaskMutationVariables>;
export const CompleteOnboardingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompleteOnboarding"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CompleteOnboardingInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completeOnboarding"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"preferences"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<CompleteOnboardingMutation, CompleteOnboardingMutationVariables>;
export const CreateDiagnosticDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateDiagnostic"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateDiagnosticInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createDiagnostic"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"confidence"}},{"kind":"Field","name":{"kind":"Name","value":"relatedArticleId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"dataSharingOptedIn"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<CreateDiagnosticMutation, CreateDiagnosticMutationVariables>;
export const CreateFlagDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateFlag"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateFlagInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createFlag"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"articleId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"sectionReference"}},{"kind":"Field","name":{"kind":"Name","value":"comment"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<CreateFlagMutation, CreateFlagMutationVariables>;
export const CreateMaintenanceTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateMaintenanceTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateMaintenanceTaskInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createMaintenanceTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","name":{"kind":"Name","value":"targetMileage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<CreateMaintenanceTaskMutation, CreateMaintenanceTaskMutationVariables>;
export const CreateMotorcycleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateMotorcycle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateMotorcycleInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createMotorcycle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"year"}},{"kind":"Field","name":{"kind":"Name","value":"nickname"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<CreateMotorcycleMutation, CreateMotorcycleMutationVariables>;
export const CreateQuizAttemptDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateQuizAttempt"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SubmitQuizInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"submitQuiz"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"quizId"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"totalQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]}}]} as unknown as DocumentNode<CreateQuizAttemptMutation, CreateQuizAttemptMutationVariables>;
export const CreateShareLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateShareLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateShareLinkInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createShareLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]} as unknown as DocumentNode<CreateShareLinkMutation, CreateShareLinkMutationVariables>;
export const DeleteAccountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteAccount"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteAccount"}}]}}]} as unknown as DocumentNode<DeleteAccountMutation, DeleteAccountMutationVariables>;
export const DeleteExpenseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteExpense"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteExpense"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteExpenseMutation, DeleteExpenseMutationVariables>;
export const DeleteMaintenanceTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteMaintenanceTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteMaintenanceTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteMaintenanceTaskMutation, DeleteMaintenanceTaskMutationVariables>;
export const DeleteMotorcycleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteMotorcycle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteMotorcycle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteMotorcycleMutation, DeleteMotorcycleMutationVariables>;
export const DeleteTaskPhotoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteTaskPhoto"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"photoId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteTaskPhoto"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"photoId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"photoId"}}}]}]}}]} as unknown as DocumentNode<DeleteTaskPhotoMutation, DeleteTaskPhotoMutationVariables>;
export const GenerateArticleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"GenerateArticle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GenerateArticleInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"generateArticle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"contentJson"}},{"kind":"Field","name":{"kind":"Name","value":"readTime"}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}}]}}]}}]} as unknown as DocumentNode<GenerateArticleMutation, GenerateArticleMutationVariables>;
export const GenerateOnboardingInsightsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"GenerateOnboardingInsights"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GenerateInsightsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"generateOnboardingInsights"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]}}]} as unknown as DocumentNode<GenerateOnboardingInsightsMutation, GenerateOnboardingInsightsMutationVariables>;
export const LogExpenseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LogExpense"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LogExpenseInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logExpense"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<LogExpenseMutation, LogExpenseMutationVariables>;
export const MarkArticleReadDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarkArticleRead"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"articleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"markArticleRead"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"articleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"articleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"articleId"}},{"kind":"Field","name":{"kind":"Name","value":"articleRead"}},{"kind":"Field","name":{"kind":"Name","value":"quizCompleted"}},{"kind":"Field","name":{"kind":"Name","value":"quizBestScore"}},{"kind":"Field","name":{"kind":"Name","value":"firstReadAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastReadAt"}}]}}]}}]} as unknown as DocumentNode<MarkArticleReadMutation, MarkArticleReadMutationVariables>;
export const RequestDataExportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RequestDataExport"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requestDataExport"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"requestedAt"}}]}}]}}]} as unknown as DocumentNode<RequestDataExportMutation, RequestDataExportMutationVariables>;
export const RevokeShareLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RevokeShareLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"linkId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"revokeShareLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"linkId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"linkId"}}}]}]}}]} as unknown as DocumentNode<RevokeShareLinkMutation, RevokeShareLinkMutationVariables>;
export const SubmitDiagnosticDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SubmitDiagnostic"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SubmitDiagnosticInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"submitDiagnostic"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"confidence"}},{"kind":"Field","name":{"kind":"Name","value":"relatedArticleId"}},{"kind":"Field","name":{"kind":"Name","value":"resultJson"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"photoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<SubmitDiagnosticMutation, SubmitDiagnosticMutationVariables>;
export const UpdateMotorcycleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateMotorcycle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateMotorcycleInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateMotorcycle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"year"}},{"kind":"Field","name":{"kind":"Name","value":"nickname"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"primaryPhotoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"currentMileage"}},{"kind":"Field","name":{"kind":"Name","value":"mileageUnit"}},{"kind":"Field","name":{"kind":"Name","value":"mileageUpdatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateMotorcycleMutation, UpdateMotorcycleMutationVariables>;
export const UpdateUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateUserInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}},{"kind":"Field","name":{"kind":"Name","value":"preferences"}}]}}]}}]} as unknown as DocumentNode<UpdateUserMutation, UpdateUserMutationVariables>;
export const AllMaintenanceTasksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AllMaintenanceTasks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"allMaintenanceTasks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","name":{"kind":"Name","value":"targetMileage"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]}}]} as unknown as DocumentNode<AllMaintenanceTasksQuery, AllMaintenanceTasksQueryVariables>;
export const ArticleBySlugFullDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ArticleBySlugFull"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"articleBySlugFull"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"contentJson"}},{"kind":"Field","name":{"kind":"Name","value":"readTime"}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<ArticleBySlugFullQuery, ArticleBySlugFullQueryVariables>;
export const DiagnosticByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DiagnosticById"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"diagnosticById"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"confidence"}},{"kind":"Field","name":{"kind":"Name","value":"relatedArticleId"}},{"kind":"Field","name":{"kind":"Name","value":"resultJson"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"photoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"dataSharingOptedIn"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<DiagnosticByIdQuery, DiagnosticByIdQueryVariables>;
export const ExpensesByMotorcycleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExpensesByMotorcycle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"year"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"expenses"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}},{"kind":"Argument","name":{"kind":"Name","value":"year"},"value":{"kind":"Variable","name":{"kind":"Name","value":"year"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ytdTotal"}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"expenses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ExpensesByMotorcycleQuery, ExpensesByMotorcycleQueryVariables>;
export const GetArticleBySlugDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetArticleBySlug"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"articleBySlug"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetArticleBySlugQuery, GetArticleBySlugQueryVariables>;
export const GetQuizByArticleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetQuizByArticle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"articleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"quizByArticle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"articleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"articleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"articleId"}},{"kind":"Field","name":{"kind":"Name","value":"questions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"question"}},{"kind":"Field","name":{"kind":"Name","value":"options"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}}]}}]}}]} as unknown as DocumentNode<GetQuizByArticleQuery, GetQuizByArticleQueryVariables>;
export const ListPopularArticlesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ListPopularArticles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"popularArticles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"readTime"}},{"kind":"Field","name":{"kind":"Name","value":"keywords"}}]}}]}}]} as unknown as DocumentNode<ListPopularArticlesQuery, ListPopularArticlesQueryVariables>;
export const MaintenanceTaskHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MaintenanceTaskHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maintenanceTaskHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","name":{"kind":"Name","value":"targetMileage"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"partsNeeded"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedMileage"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"oemScheduleId"}},{"kind":"Field","name":{"kind":"Name","value":"intervalKm"}},{"kind":"Field","name":{"kind":"Name","value":"intervalDays"}},{"kind":"Field","name":{"kind":"Name","value":"isRecurring"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<MaintenanceTaskHistoryQuery, MaintenanceTaskHistoryQueryVariables>;
export const MaintenanceTasksByMotorcycleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MaintenanceTasksByMotorcycle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maintenanceTasks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","name":{"kind":"Name","value":"targetMileage"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"partsNeeded"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedMileage"}},{"kind":"Field","name":{"kind":"Name","value":"cost"}},{"kind":"Field","name":{"kind":"Name","value":"partsCost"}},{"kind":"Field","name":{"kind":"Name","value":"laborCost"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"isRecurring"}},{"kind":"Field","name":{"kind":"Name","value":"intervalKm"}},{"kind":"Field","name":{"kind":"Name","value":"intervalDays"}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"storagePath"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<MaintenanceTasksByMotorcycleQuery, MaintenanceTasksByMotorcycleQueryVariables>;
export const MeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"preferences"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<MeQuery, MeQueryVariables>;
export const MotorcycleMakesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MotorcycleMakes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"motorcycleMakes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"makeId"}},{"kind":"Field","name":{"kind":"Name","value":"makeName"}},{"kind":"Field","name":{"kind":"Name","value":"isPopular"}}]}}]}}]} as unknown as DocumentNode<MotorcycleMakesQuery, MotorcycleMakesQueryVariables>;
export const MotorcycleModelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MotorcycleModels"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"makeId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"year"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"motorcycleModels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"makeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"makeId"}}},{"kind":"Argument","name":{"kind":"Name","value":"year"},"value":{"kind":"Variable","name":{"kind":"Name","value":"year"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modelId"}},{"kind":"Field","name":{"kind":"Name","value":"modelName"}}]}}]}}]} as unknown as DocumentNode<MotorcycleModelsQuery, MotorcycleModelsQueryVariables>;
export const MyDiagnosticsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyDiagnostics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myDiagnostics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"confidence"}},{"kind":"Field","name":{"kind":"Name","value":"relatedArticleId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"dataSharingOptedIn"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<MyDiagnosticsQuery, MyDiagnosticsQueryVariables>;
export const MyMotorcyclesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyMotorcycles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myMotorcycles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"year"}},{"kind":"Field","name":{"kind":"Name","value":"nickname"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"primaryPhotoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"currentMileage"}},{"kind":"Field","name":{"kind":"Name","value":"mileageUnit"}},{"kind":"Field","name":{"kind":"Name","value":"mileageUpdatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<MyMotorcyclesQuery, MyMotorcyclesQueryVariables>;
export const MyProgressDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyProgress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myProgress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"articleId"}},{"kind":"Field","name":{"kind":"Name","value":"articleRead"}},{"kind":"Field","name":{"kind":"Name","value":"quizCompleted"}},{"kind":"Field","name":{"kind":"Name","value":"quizBestScore"}},{"kind":"Field","name":{"kind":"Name","value":"firstReadAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastReadAt"}}]}}]}}]} as unknown as DocumentNode<MyProgressQuery, MyProgressQueryVariables>;
export const MyShareLinksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyShareLinks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myShareLinks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]} as unknown as DocumentNode<MyShareLinksQuery, MyShareLinksQueryVariables>;
export const SearchArticlesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchArticles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SearchArticlesInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchArticles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"keywords"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}},{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<SearchArticlesQuery, SearchArticlesQueryVariables>;
export const SpendingSummaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SpendingSummary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"spendingSummary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"thisYear"}},{"kind":"Field","name":{"kind":"Name","value":"allTime"}}]}}]}}]} as unknown as DocumentNode<SpendingSummaryQuery, SpendingSummaryQueryVariables>;
export const JoinWaitlistDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinWaitlist"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinWaitlist"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}}]}]}}]} as unknown as DocumentNode<JoinWaitlistMutation, JoinWaitlistMutationVariables>;