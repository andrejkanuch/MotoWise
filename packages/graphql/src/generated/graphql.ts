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
  /** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
  DateTime: { input: string; output: string; }
  /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSON: { input: Record<string, unknown>; output: Record<string, unknown>; }
};

export type AddDocumentCategoryInput = {
  name: Scalars['String']['input'];
};

export type AddExpensePhotoInput = {
  expenseId: Scalars['String']['input'];
  fileSizeBytes?: InputMaybe<Scalars['Int']['input']>;
  storagePath: Scalars['String']['input'];
};

export type AddTaskPhotoInput = {
  fileSizeBytes?: InputMaybe<Scalars['Int']['input']>;
  storagePath: Scalars['String']['input'];
  taskId: Scalars['String']['input'];
};

export type AdminMotorcycleSpecDraft = {
  __typename?: 'AdminMotorcycleSpecDraft';
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isSafetyCritical: Scalars['Boolean']['output'];
  make: Scalars['String']['output'];
  model?: Maybe<Scalars['String']['output']>;
  sourceContext?: Maybe<Scalars['String']['output']>;
  sourcePage?: Maybe<Scalars['String']['output']>;
  sourceTitle?: Maybe<Scalars['String']['output']>;
  specName: Scalars['String']['output'];
  specType: Scalars['String']['output'];
  unit: Scalars['String']['output'];
  valueDisplay?: Maybe<Scalars['String']['output']>;
  valueNumeric: Scalars['Float']['output'];
  variant?: Maybe<Scalars['String']['output']>;
};

export type AdminOemScheduleDraft = {
  __typename?: 'AdminOemScheduleDraft';
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  intervalDays?: Maybe<Scalars['Int']['output']>;
  intervalKm?: Maybe<Scalars['Int']['output']>;
  isSafetyCritical: Scalars['Boolean']['output'];
  make: Scalars['String']['output'];
  model?: Maybe<Scalars['String']['output']>;
  priority: MaintenancePriority;
  sourceContext?: Maybe<Scalars['String']['output']>;
  sourcePage?: Maybe<Scalars['String']['output']>;
  sourceTitle?: Maybe<Scalars['String']['output']>;
  taskName: Scalars['String']['output'];
  variant?: Maybe<Scalars['String']['output']>;
};

/** Affiliate partner for product recommendations */
export enum AffiliatePartner {
  Amazon = 'amazon',
  Revzilla = 'revzilla',
  RockyMountain = 'rocky_mountain'
}

export type AffiliateProduct = {
  __typename?: 'AffiliateProduct';
  affiliateUrl: Scalars['String']['output'];
  partner: AffiliatePartner;
  productUrl: Scalars['String']['output'];
  tracked: Scalars['Boolean']['output'];
};

export type AiBudgetStatus = {
  __typename?: 'AiBudgetStatus';
  circuitBreakerOpen: Scalars['Boolean']['output'];
  dailySpendCapCents: Scalars['Int']['output'];
  todayGenerationCount: Scalars['Int']['output'];
  todaySpendCents: Scalars['Int']['output'];
};

export type ApproveMaintenanceDraftInput = {
  id: Scalars['ID']['input'];
  kind: Scalars['String']['input'];
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

export type AskTripAssistantInput = {
  history?: InputMaybe<Array<TripAssistantHistoryMessage>>;
  question: Scalars['String']['input'];
  tripId: Scalars['ID']['input'];
};

/** Role of a message in the trip assistant conversation. */
export enum AssistantMessageRole {
  Assistant = 'assistant',
  User = 'user'
}

export type BlogCategory = {
  __typename?: 'BlogCategory';
  id: Scalars['ID']['output'];
  isPrimary?: Maybe<Scalars['Boolean']['output']>;
  name: Scalars['String']['output'];
  parentId?: Maybe<Scalars['ID']['output']>;
  slug: Scalars['String']['output'];
};

export type BlogKeyword = {
  __typename?: 'BlogKeyword';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  slug: Scalars['String']['output'];
};

export type BlogPost = {
  __typename?: 'BlogPost';
  author?: Maybe<Scalars['String']['output']>;
  categories: Array<BlogCategory>;
  coverAlt?: Maybe<Scalars['String']['output']>;
  coverImage?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isSafetyCritical: Scalars['Boolean']['output'];
  keywords: Array<BlogKeyword>;
  publishedAt?: Maybe<Scalars['String']['output']>;
  scheduledFor?: Maybe<Scalars['String']['output']>;
  slug: Scalars['String']['output'];
  specData: Scalars['Boolean']['output'];
  status: Scalars['String']['output'];
  translations: Array<BlogTranslation>;
  type: Scalars['String']['output'];
  typeData?: Maybe<Scalars['JSON']['output']>;
  updatedAt: Scalars['String']['output'];
};

export type BlogPostConnection = {
  __typename?: 'BlogPostConnection';
  edges: Array<BlogPostEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type BlogPostEdge = {
  __typename?: 'BlogPostEdge';
  cursor: Scalars['String']['output'];
  node: BlogPost;
};

export type BlogPostVersion = {
  __typename?: 'BlogPostVersion';
  createdAt: Scalars['String']['output'];
  createdBy?: Maybe<Scalars['ID']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  versionNum: Scalars['Int']['output'];
};

export type BlogTranslation = {
  __typename?: 'BlogTranslation';
  bodyRaw: Scalars['String']['output'];
  excerpt?: Maybe<Scalars['String']['output']>;
  faq?: Maybe<Scalars['JSON']['output']>;
  locale: Scalars['String']['output'];
  readingTime?: Maybe<Scalars['String']['output']>;
  seoDescription?: Maybe<Scalars['String']['output']>;
  seoTitle?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  wordCount?: Maybe<Scalars['Int']['output']>;
};

export type BlogTranslationInput = {
  bodyRaw: Scalars['String']['input'];
  excerpt?: InputMaybe<Scalars['String']['input']>;
  faq?: InputMaybe<Scalars['JSON']['input']>;
  locale: Scalars['String']['input'];
  readingTime?: InputMaybe<Scalars['String']['input']>;
  seoDescription?: InputMaybe<Scalars['String']['input']>;
  seoTitle?: InputMaybe<Scalars['String']['input']>;
  title: Scalars['String']['input'];
};

export type BrowseExploreRegionResult = {
  __typename?: 'BrowseExploreRegionResult';
  country: BrowsePlace;
  region: BrowsePlace;
};

/** Public place row for explore / browse (countries, regions) */
export type BrowsePlace = {
  __typename?: 'BrowsePlace';
  countryCode: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  kind: Scalars['String']['output'];
  name: Scalars['String']['output'];
  parentId?: Maybe<Scalars['String']['output']>;
  regionCode?: Maybe<Scalars['String']['output']>;
  routeCount: Scalars['Int']['output'];
  slug: Scalars['String']['output'];
};

export type CategoryTotal = {
  __typename?: 'CategoryTotal';
  category: Scalars['String']['output'];
  total: Scalars['Float']['output'];
};

export type Comment = {
  __typename?: 'Comment';
  author: CommentAuthor;
  createdAt: Scalars['String']['output'];
  flaggedCount: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  parentCommentId?: Maybe<Scalars['ID']['output']>;
  replies?: Maybe<Array<Comment>>;
  text: Scalars['String']['output'];
};

export type CommentAuthor = {
  __typename?: 'CommentAuthor';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  publicUsername?: Maybe<Scalars['String']['output']>;
};

export type CommentConnection = {
  __typename?: 'CommentConnection';
  comments: Array<Comment>;
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  totalCount: Scalars['Int']['output'];
};

export type CompleteMaintenanceTaskInput = {
  completedMileage?: InputMaybe<Scalars['Int']['input']>;
  cost?: InputMaybe<Scalars['Float']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  laborCost?: InputMaybe<Scalars['Float']['input']>;
  partsCost?: InputMaybe<Scalars['Float']['input']>;
};

export type CompleteOnboardingInput = {
  /** OEM schedule IDs the user accepted in the maintenance swipe screen */
  acceptedOemScheduleIds?: InputMaybe<Array<Scalars['String']['input']>>;
  annualRepairSpend?: InputMaybe<Scalars['String']['input']>;
  bikeMake?: InputMaybe<Scalars['String']['input']>;
  bikeMileage?: InputMaybe<Scalars['Int']['input']>;
  bikeMileageUnit?: InputMaybe<Scalars['String']['input']>;
  bikeModel?: InputMaybe<Scalars['String']['input']>;
  bikeNickname?: InputMaybe<Scalars['String']['input']>;
  bikePhotoUrl?: InputMaybe<Scalars['String']['input']>;
  bikeType?: InputMaybe<Scalars['String']['input']>;
  bikeYear?: InputMaybe<Scalars['Int']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  /** UUID for client-server event deduplication with Meta CAPI */
  eventId?: InputMaybe<Scalars['String']['input']>;
  experienceLevel: Scalars['String']['input'];
  /** Meta click ID from deep link for CAPI attribution */
  fbclid?: InputMaybe<Scalars['String']['input']>;
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

export type ConditionAggregate = {
  __typename?: 'ConditionAggregate';
  condition: Scalars['String']['output'];
  count: Scalars['Int']['output'];
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

export type CreateBlogCategoryInput = {
  name: Scalars['String']['input'];
  parentId?: InputMaybe<Scalars['ID']['input']>;
};

export type CreateBlogKeywordInput = {
  name: Scalars['String']['input'];
};

export type CreateBlogPostInput = {
  author?: InputMaybe<Scalars['String']['input']>;
  categoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  coverAlt?: InputMaybe<Scalars['String']['input']>;
  coverImage?: InputMaybe<Scalars['String']['input']>;
  isSafetyCritical?: InputMaybe<Scalars['Boolean']['input']>;
  keywordIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  scheduledFor?: InputMaybe<Scalars['String']['input']>;
  slug: Scalars['String']['input'];
  specData?: InputMaybe<Scalars['Boolean']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  translations: Array<BlogTranslationInput>;
  type: Scalars['String']['input'];
  typeData: Scalars['JSON']['input'];
};

export type CreateCommentInput = {
  groupRideId?: InputMaybe<Scalars['ID']['input']>;
  parentCommentId?: InputMaybe<Scalars['ID']['input']>;
  rideId?: InputMaybe<Scalars['ID']['input']>;
  routeId?: InputMaybe<Scalars['ID']['input']>;
  text: Scalars['String']['input'];
  tripId?: InputMaybe<Scalars['ID']['input']>;
};

export type CreateDiagnosticInput = {
  dataSharingOptedIn?: Scalars['Boolean']['input'];
  motorcycleId?: InputMaybe<Scalars['String']['input']>;
  wizardAnswers?: InputMaybe<Scalars['JSON']['input']>;
};

export type CreateDocumentInput = {
  categoryId: Scalars['String']['input'];
  documentId: Scalars['String']['input'];
  expiryDate?: InputMaybe<Scalars['String']['input']>;
  files: Array<DocumentFileInput>;
  motorcycleId: Scalars['String']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  title: Scalars['String']['input'];
};

export type CreateFlagInput = {
  articleId: Scalars['String']['input'];
  comment: Scalars['String']['input'];
  sectionReference?: InputMaybe<Scalars['String']['input']>;
};

export type CreateFuelLogInput = {
  currency?: InputMaybe<Scalars['String']['input']>;
  filledAt?: InputMaybe<Scalars['String']['input']>;
  fuelLitres: Scalars['Float']['input'];
  fuelType?: InputMaybe<Scalars['String']['input']>;
  isPartial?: InputMaybe<Scalars['Boolean']['input']>;
  motorcycleId: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  odometerKm: Scalars['Float']['input'];
  totalCost?: InputMaybe<Scalars['Float']['input']>;
};

export type CreateGroupRideInput = {
  dateTime: Scalars['String']['input'];
  description: Scalars['String']['input'];
  difficulty: Scalars['String']['input'];
  maxRiders: Scalars['Int']['input'];
  meetingPointLat: Scalars['Float']['input'];
  meetingPointLng: Scalars['Float']['input'];
  meetingPointName?: InputMaybe<Scalars['String']['input']>;
  routeDescription?: InputMaybe<Scalars['String']['input']>;
  routeId?: InputMaybe<Scalars['String']['input']>;
  title: Scalars['String']['input'];
};

export type CreateMaintenanceTaskInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  dueDate?: InputMaybe<Scalars['String']['input']>;
  intervalDays?: InputMaybe<Scalars['Int']['input']>;
  intervalKm?: InputMaybe<Scalars['Int']['input']>;
  isRecurring?: InputMaybe<Scalars['Boolean']['input']>;
  motorcycleId: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  partsNeeded?: InputMaybe<Array<Scalars['String']['input']>>;
  priority?: InputMaybe<MaintenancePriority>;
  remind1d?: InputMaybe<Scalars['Boolean']['input']>;
  remind7d?: InputMaybe<Scalars['Boolean']['input']>;
  remind30d?: InputMaybe<Scalars['Boolean']['input']>;
  targetMileage?: InputMaybe<Scalars['Int']['input']>;
  title: Scalars['String']['input'];
};

export type CreateMotorcycleInput = {
  make: Scalars['String']['input'];
  model: Scalars['String']['input'];
  nickname?: InputMaybe<Scalars['String']['input']>;
  variant?: InputMaybe<Scalars['String']['input']>;
  year: Scalars['Int']['input'];
};

export type CreateShareLinkInput = {
  expiresInDays?: InputMaybe<Scalars['Int']['input']>;
  motorcycleId: Scalars['String']['input'];
};

export type CreateTripInput = {
  description: Scalars['String']['input'];
  difficulty: Scalars['String']['input'];
  endDate: Scalars['String']['input'];
  maxRiders: Scalars['Int']['input'];
  startDate: Scalars['String']['input'];
  title: Scalars['String']['input'];
};

export type CreateTripReviewInput = {
  bikeId?: InputMaybe<Scalars['ID']['input']>;
  conditionTags?: InputMaybe<Array<Scalars['String']['input']>>;
  rating: Scalars['Int']['input'];
  text?: InputMaybe<Scalars['String']['input']>;
  tripId: Scalars['ID']['input'];
};

export type CreateTripSuggestionInput = {
  dayIndex?: InputMaybe<Scalars['Int']['input']>;
  kind?: TripSuggestionKind;
  lat?: InputMaybe<Scalars['Float']['input']>;
  lng?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  periodOfDay?: InputMaybe<PeriodOfDay>;
  tripId: Scalars['ID']['input'];
};

export type CreateTripWithWaypointsInput = {
  dayCount?: InputMaybe<Scalars['Int']['input']>;
  description: Scalars['String']['input'];
  difficulty: Scalars['String']['input'];
  endDate?: InputMaybe<Scalars['String']['input']>;
  isShowcase?: InputMaybe<Scalars['Boolean']['input']>;
  maxRiders: Scalars['Int']['input'];
  startDate?: InputMaybe<Scalars['String']['input']>;
  title: Scalars['String']['input'];
  visibility?: InputMaybe<Scalars['String']['input']>;
  waypoints: Array<InlineWaypointInput>;
};

export type CreateWaypointInput = {
  dayIndex?: Scalars['Int']['input'];
  lat: Scalars['Float']['input'];
  lng: Scalars['Float']['input'];
  name: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  periodOfDay?: InputMaybe<PeriodOfDay>;
  sortOrder: Scalars['Int']['input'];
  tripId: Scalars['ID']['input'];
  type: Scalars['String']['input'];
};

export type DailyDistance = {
  __typename?: 'DailyDistance';
  date: Scalars['String']['output'];
  distanceM: Scalars['Float']['output'];
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

export type Document = {
  __typename?: 'Document';
  categoryId: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  expiryDate?: Maybe<Scalars['String']['output']>;
  files: Array<DocumentFile>;
  id: Scalars['ID']['output'];
  isPinned: Scalars['Boolean']['output'];
  motorcycleId: Scalars['String']['output'];
  note?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type DocumentCategory = {
  __typename?: 'DocumentCategory';
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isHidden: Scalars['Boolean']['output'];
  kind: Scalars['String']['output'];
  name: Scalars['String']['output'];
  promptsExpiry: Scalars['Boolean']['output'];
  updatedAt: Scalars['String']['output'];
};

export type DocumentFile = {
  __typename?: 'DocumentFile';
  createdAt: Scalars['String']['output'];
  documentId: Scalars['String']['output'];
  fileSizeBytes?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  mimeType: Scalars['String']['output'];
};

export type DocumentFileInput = {
  fileSizeBytes: Scalars['Int']['input'];
  mimeType: Scalars['String']['input'];
  storagePath: Scalars['String']['input'];
};

export type EndRideInput = {
  autoPausedDurationS?: Scalars['Int']['input'];
  avgSpeedMps?: InputMaybe<Scalars['Float']['input']>;
  distanceM?: Scalars['Float']['input'];
  elevationGain?: InputMaybe<Scalars['Float']['input']>;
  elevationLoss?: InputMaybe<Scalars['Float']['input']>;
  endedAt: Scalars['String']['input'];
  gpsQuality?: InputMaybe<Scalars['Float']['input']>;
  maxLeanAngle?: InputMaybe<Scalars['Float']['input']>;
  maxSpeedMps?: InputMaybe<Scalars['Float']['input']>;
  pausedDurationS?: Scalars['Int']['input'];
  rideId: Scalars['String']['input'];
  routePolyline?: InputMaybe<Scalars['String']['input']>;
};

export type EndRideResponse = {
  __typename?: 'EndRideResponse';
  ride: Ride;
  triggeredMaintenanceTasks: Array<TriggeredMaintenanceTask>;
};

export type Expense = {
  __typename?: 'Expense';
  amount: Scalars['Float']['output'];
  category: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  currency: Scalars['String']['output'];
  date: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  itemName?: Maybe<Scalars['String']['output']>;
  maintenanceTaskId?: Maybe<Scalars['String']['output']>;
  motorcycleId: Scalars['String']['output'];
  photos?: Maybe<Array<ExpensePhoto>>;
};

export type ExpenseCategory = {
  __typename?: 'ExpenseCategory';
  category: Scalars['String']['output'];
  expenses: Array<Expense>;
  total: Scalars['Float']['output'];
};

export type ExpenseDashboardSummary = {
  __typename?: 'ExpenseDashboardSummary';
  allTimeTotal: Scalars['Float']['output'];
  categoryTotals: Array<CategoryTotal>;
  currentYearTotal: Scalars['Float']['output'];
  expenseCount: Scalars['Int']['output'];
  monthlyBuckets: Array<MonthlyBucket>;
  previousYearTotal: Scalars['Float']['output'];
};

export type ExpensePhoto = {
  __typename?: 'ExpensePhoto';
  createdAt: Scalars['String']['output'];
  expenseId: Scalars['String']['output'];
  fileSizeBytes?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  mimeType: Scalars['String']['output'];
  publicUrl: Scalars['String']['output'];
  storagePath: Scalars['String']['output'];
};

export type ExpenseSummary = {
  __typename?: 'ExpenseSummary';
  categories: Array<ExpenseCategory>;
  ytdTotal: Scalars['Float']['output'];
};

export type FeedBike = {
  __typename?: 'FeedBike';
  make: Scalars['String']['output'];
  model: Scalars['String']['output'];
  nickname?: Maybe<Scalars['String']['output']>;
  year: Scalars['Int']['output'];
};

export type FeedRide = {
  __typename?: 'FeedRide';
  aiSummary?: Maybe<Scalars['String']['output']>;
  bike?: Maybe<FeedBike>;
  commentCount: Scalars['Int']['output'];
  distanceM?: Maybe<Scalars['Int']['output']>;
  elevationGain?: Maybe<Scalars['Float']['output']>;
  elevationLoss?: Maybe<Scalars['Float']['output']>;
  endedAt?: Maybe<Scalars['String']['output']>;
  hasKudos: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  kudosCount: Scalars['Int']['output'];
  name?: Maybe<Scalars['String']['output']>;
  rider: FeedRider;
  routeThumbnailUri?: Maybe<Scalars['String']['output']>;
  startedAt: Scalars['String']['output'];
};

export type FeedRideConnection = {
  __typename?: 'FeedRideConnection';
  edges: Array<FeedRideEdge>;
  pageInfo: PageInfo;
};

export type FeedRideEdge = {
  __typename?: 'FeedRideEdge';
  cursor: Scalars['String']['output'];
  node: FeedRide;
};

export type FeedRider = {
  __typename?: 'FeedRider';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  publicUsername: Scalars['String']['output'];
};

export enum FlagStatus {
  Dismissed = 'dismissed',
  Pending = 'pending',
  Resolved = 'resolved',
  Reviewed = 'reviewed'
}

export type Follow = {
  __typename?: 'Follow';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  displayName?: Maybe<Scalars['String']['output']>;
  followerId: Scalars['ID']['output'];
  followingId: Scalars['ID']['output'];
  publicUsername?: Maybe<Scalars['String']['output']>;
};

export type FollowConnection = {
  __typename?: 'FollowConnection';
  edges: Array<FollowEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type FollowEdge = {
  __typename?: 'FollowEdge';
  cursor: Scalars['String']['output'];
  node: Follow;
};

export type FollowRiderInput = {
  targetUserId: Scalars['String']['input'];
};

export type FuelLog = {
  __typename?: 'FuelLog';
  createdAt: Scalars['String']['output'];
  currency: Scalars['String']['output'];
  filledAt: Scalars['String']['output'];
  fuelLitres: Scalars['Float']['output'];
  fuelType: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isPartial: Scalars['Boolean']['output'];
  kmSincePrevious?: Maybe<Scalars['Float']['output']>;
  litresPer100Km?: Maybe<Scalars['Float']['output']>;
  motorcycleId: Scalars['String']['output'];
  mpgUs?: Maybe<Scalars['Float']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  odometerKm: Scalars['Float']['output'];
  totalCost?: Maybe<Scalars['Float']['output']>;
};

export type FuelRangeResult = {
  __typename?: 'FuelRangeResult';
  fuelStops: Array<FuelStop>;
  rangeSummary: FuelRangeSummary;
};

export type FuelRangeSummary = {
  __typename?: 'FuelRangeSummary';
  effectiveRangeKm: Scalars['Float']['output'];
  stopsRequired: Scalars['Int']['output'];
  summary: Scalars['String']['output'];
};

export type FuelStop = {
  __typename?: 'FuelStop';
  amenity: Scalars['String']['output'];
  lat: Scalars['Float']['output'];
  lng: Scalars['Float']['output'];
  name: Scalars['String']['output'];
  osmId: Scalars['ID']['output'];
};

export type GpxExportError = {
  __typename?: 'GPXExportError';
  code: Scalars['String']['output'];
  quotaRemaining?: Maybe<Scalars['Int']['output']>;
  reason: Scalars['String']['output'];
  upgradeUrl?: Maybe<Scalars['String']['output']>;
};

export type GpxExportResult = GpxExportError | GpxExportSuccess;

export type GpxExportSuccess = {
  __typename?: 'GPXExportSuccess';
  fileName: Scalars['String']['output'];
  fileUrl: Scalars['String']['output'];
  message: Scalars['String']['output'];
};

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

export type GenerateReportInput = {
  bikeId: Scalars['String']['input'];
};

/** Status of AI content generation (e.g. ride summaries) */
export enum GenerationStatus {
  Completed = 'completed',
  Failed = 'failed',
  Pending = 'pending'
}

export type GroupRide = {
  __typename?: 'GroupRide';
  createdAt: Scalars['String']['output'];
  dateTime: Scalars['String']['output'];
  description: Scalars['String']['output'];
  difficulty: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  maxRiders: Scalars['Int']['output'];
  meetingPointLat: Scalars['Float']['output'];
  meetingPointLng: Scalars['Float']['output'];
  meetingPointName?: Maybe<Scalars['String']['output']>;
  organiser: GroupRideOrganiser;
  participantCount: Scalars['Int']['output'];
  participants?: Maybe<Array<GroupRideParticipant>>;
  routeDescription?: Maybe<Scalars['String']['output']>;
  routeId?: Maybe<Scalars['ID']['output']>;
  status: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type GroupRideConnection = {
  __typename?: 'GroupRideConnection';
  edges: Array<GroupRideEdge>;
  pageInfo: GroupRidePageInfo;
};

export type GroupRideEdge = {
  __typename?: 'GroupRideEdge';
  cursor: Scalars['String']['output'];
  node: GroupRide;
};

export type GroupRideOrganiser = {
  __typename?: 'GroupRideOrganiser';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  publicUsername?: Maybe<Scalars['String']['output']>;
};

export type GroupRidePageInfo = {
  __typename?: 'GroupRidePageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
};

export type GroupRideParticipant = {
  __typename?: 'GroupRideParticipant';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  joinedAt: Scalars['String']['output'];
  publicUsername?: Maybe<Scalars['String']['output']>;
};

export type HealthReport = {
  __typename?: 'HealthReport';
  completedAt?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  iapTransactionId?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  motorcycleId?: Maybe<Scalars['ID']['output']>;
  pdfUrl?: Maybe<Scalars['String']['output']>;
  status: HealthReportStatus;
  userId: Scalars['String']['output'];
};

/** Status of a bike health report generation */
export enum HealthReportStatus {
  Completed = 'completed',
  Failed = 'failed',
  Pending = 'pending'
}

export type InlineWaypointInput = {
  dayIndex?: Scalars['Int']['input'];
  lat: Scalars['Float']['input'];
  lng: Scalars['Float']['input'];
  name: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  periodOfDay?: InputMaybe<PeriodOfDay>;
  sortOrder: Scalars['Int']['input'];
  type: Scalars['String']['input'];
};

export enum InsightType {
  Community = 'community',
  Learning = 'learning',
  Maintenance = 'maintenance'
}

export type JoinTripInput = {
  bikeId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  tripId: Scalars['ID']['input'];
};

export type KudosResult = {
  __typename?: 'KudosResult';
  hasKudos: Scalars['Boolean']['output'];
  kudosCount: Scalars['Int']['output'];
};

export type KudosUser = {
  __typename?: 'KudosUser';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  displayName?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  publicUsername?: Maybe<Scalars['String']['output']>;
};

export type LastRideSummary = {
  __typename?: 'LastRideSummary';
  date: Scalars['String']['output'];
  distanceM: Scalars['Float']['output'];
  durationS: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  maxSpeedMps?: Maybe<Scalars['Float']['output']>;
  motorcycleName?: Maybe<Scalars['String']['output']>;
  summaryTitle?: Maybe<Scalars['String']['output']>;
};

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

export type ListBlogPostsInput = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<Scalars['String']['input']>;
};

export type LogExpenseInput = {
  amount: Scalars['Float']['input'];
  category: Scalars['String']['input'];
  currency?: InputMaybe<Scalars['String']['input']>;
  date: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  itemName?: InputMaybe<Scalars['String']['input']>;
  motorcycleId: Scalars['String']['input'];
};

export type MaintenanceDraftReview = {
  __typename?: 'MaintenanceDraftReview';
  schedules: Array<AdminOemScheduleDraft>;
  specs: Array<AdminMotorcycleSpecDraft>;
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
  remind1d: Scalars['Boolean']['output'];
  remind7d: Scalars['Boolean']['output'];
  remind30d: Scalars['Boolean']['output'];
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

/** Aggregated fleet stats for a motorcycle make */
export type MakeStats = {
  __typename?: 'MakeStats';
  /** Make name (title case, e.g. "BMW") */
  make: Scalars['String']['output'];
  /** Distinct models tracked for this make */
  models: Scalars['Int']['output'];
  /** Popularity rank (1 = most riders) */
  rank: Scalars['Int']['output'];
  /** Distinct riders who own this make */
  riders: Scalars['Int']['output'];
  /** Total bikes of this make in the fleet */
  totalBikes: Scalars['Int']['output'];
};

export type ManualBikeInfoInput = {
  make?: InputMaybe<Scalars['String']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  type: MotorcycleType;
  year?: InputMaybe<Scalars['Int']['input']>;
};

export type MonthlyBucket = {
  __typename?: 'MonthlyBucket';
  categories: Array<CategoryTotal>;
  month: Scalars['Int']['output'];
  total: Scalars['Float']['output'];
  year: Scalars['Int']['output'];
};

export type Motorcycle = {
  __typename?: 'Motorcycle';
  createdAt: Scalars['String']['output'];
  currentMileage?: Maybe<Scalars['Int']['output']>;
  documents: Array<Document>;
  engineCc?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  isPrimary: Scalars['Boolean']['output'];
  make: Scalars['String']['output'];
  mileageUnit?: Maybe<Scalars['String']['output']>;
  mileageUpdatedAt?: Maybe<Scalars['String']['output']>;
  model: Scalars['String']['output'];
  nickname?: Maybe<Scalars['String']['output']>;
  odometerLastRideId?: Maybe<Scalars['String']['output']>;
  odometerSyncSource?: Maybe<Scalars['String']['output']>;
  primaryPhotoUrl?: Maybe<Scalars['String']['output']>;
  purchaseDate?: Maybe<Scalars['String']['output']>;
  purchasePrice?: Maybe<Scalars['Float']['output']>;
  recallCount?: Maybe<Scalars['Int']['output']>;
  recallLastCheckedAt?: Maybe<Scalars['String']['output']>;
  type?: Maybe<MotorcycleType>;
  userId: Scalars['String']['output'];
  variant?: Maybe<Scalars['String']['output']>;
  vin?: Maybe<Scalars['String']['output']>;
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
  addDocumentCategory: DocumentCategory;
  addExpensePhoto: ExpensePhoto;
  addTaskPhoto: TaskPhoto;
  addWaypoint: TripWaypoint;
  approveMaintenanceDraft: Scalars['Boolean']['output'];
  askTripAssistant: TripAssistantMessage;
  cancelGroupRide: Scalars['Boolean']['output'];
  /** Returns the new trip ID */
  cloneTrip: Scalars['ID']['output'];
  completeMaintenanceTask: CompleteTaskResult;
  completeOnboarding: User;
  createBlogCategory: BlogCategory;
  createBlogKeyword: BlogKeyword;
  createBlogPost: BlogPost;
  createComment: Comment;
  createDiagnostic: Diagnostic;
  createDocument: Document;
  createFlag: ContentFlag;
  createFuelLog: FuelLog;
  createGroupRide: GroupRide;
  createMaintenanceTask: MaintenanceTask;
  createMotorcycle: Motorcycle;
  createShareLink: ShareLink;
  createTrip: Trip;
  createTripReview: TripReview;
  createTripSuggestion: TripSuggestion;
  createTripWithWaypoints: Trip;
  deleteAccount: Scalars['Boolean']['output'];
  deleteBlogPost: Scalars['Boolean']['output'];
  deleteComment: Scalars['Boolean']['output'];
  deleteDocument: Scalars['Boolean']['output'];
  deleteDocumentCategory: Scalars['Boolean']['output'];
  deleteExpense: Scalars['Boolean']['output'];
  deleteExpensePhoto: Scalars['Boolean']['output'];
  deleteFuelLog: Scalars['Boolean']['output'];
  deleteMaintenanceTask: Scalars['Boolean']['output'];
  deleteMotorcycle: Scalars['Boolean']['output'];
  deleteRide: Scalars['Boolean']['output'];
  deleteTaskPhoto: Scalars['Boolean']['output'];
  deleteTrip: Scalars['Boolean']['output'];
  deleteTripReview: Scalars['Boolean']['output'];
  endRide: EndRideResponse;
  /** Export a trip template as GPX. Metered for free users (1/month), unlimited for Pro. */
  exportTripGPX: GpxExportResult;
  flagComment: Scalars['Boolean']['output'];
  followRider: Follow;
  generateArticle: Article;
  generateBikeHealthReport: HealthReport;
  generateOnboardingInsights: Array<OnboardingInsight>;
  importOemSchedule: Scalars['Int']['output'];
  inviteToTrip: Scalars['Boolean']['output'];
  joinGroupRide: Scalars['Boolean']['output'];
  joinPremiumWaitlist: Scalars['Boolean']['output'];
  joinTrip: Scalars['Boolean']['output'];
  /** Submit email to join waitlist (public, no auth) */
  joinWaitlist: Scalars['Boolean']['output'];
  leaveGroupRide: Scalars['Boolean']['output'];
  leaveTrip: Scalars['Boolean']['output'];
  logExpense: Expense;
  markArticleRead: LearningProgress;
  publishAsTemplate: Trip;
  publishBlogPost: BlogPost;
  publishTrip: Trip;
  regenerateRideSummary: RideSummary;
  removeWaypoint: Scalars['Boolean']['output'];
  reorderWaypoints: Scalars['Boolean']['output'];
  reportSurface: SurfaceReport;
  requestDataExport: DataExportRequest;
  resetAiCircuitBreaker: Scalars['Boolean']['output'];
  respondToTripInvite: Scalars['Boolean']['output'];
  respondToTripSuggestion: TripSuggestion;
  revertBlogPostVersion: BlogPost;
  revokeShareLink: Scalars['Boolean']['output'];
  rotateTripShareToken: Scalars['String']['output'];
  saveTrip: Scalars['Boolean']['output'];
  scheduleBlogPost: BlogPost;
  setTripParticipantRole: Scalars['Boolean']['output'];
  shareRide: Scalars['Boolean']['output'];
  /** Share a completed ride as a published template trip on Discover. Replaces shareRideToDiscover. */
  shareRideAsTrip: Trip;
  startRide: Ride;
  submitDiagnostic: Diagnostic;
  submitQuiz: QuizAttempt;
  toggleKudos: KudosResult;
  trackAffiliateClick: AffiliateProduct;
  trackSponsorshipClick: Scalars['Boolean']['output'];
  trackSponsorshipImpression: Scalars['Boolean']['output'];
  unfollowRider: Scalars['Boolean']['output'];
  unpublishBlogPost: BlogPost;
  unpublishTemplate: Scalars['Boolean']['output'];
  unsaveTrip: Scalars['Boolean']['output'];
  unshareRide: Scalars['Boolean']['output'];
  updateBlogPost: BlogPost;
  updateDocument: Document;
  updateDocumentCategory: DocumentCategory;
  updateGroupRide: GroupRide;
  updateHandle: User;
  updateMaintenanceTask: MaintenanceTask;
  updateMotorcycle: Motorcycle;
  updateMyProfile: User;
  updateParticipantStatus: Scalars['Boolean']['output'];
  updateRide: Ride;
  updateRideVisibility: Ride;
  updateTrip: Trip;
  updateUser: User;
  updateWaypoint: TripWaypoint;
  uploadWaypoints: Scalars['Int']['output'];
};


export type MutationAddDocumentCategoryArgs = {
  input: AddDocumentCategoryInput;
};


export type MutationAddExpensePhotoArgs = {
  input: AddExpensePhotoInput;
};


export type MutationAddTaskPhotoArgs = {
  input: AddTaskPhotoInput;
};


export type MutationAddWaypointArgs = {
  input: CreateWaypointInput;
};


export type MutationApproveMaintenanceDraftArgs = {
  input: ApproveMaintenanceDraftInput;
};


export type MutationAskTripAssistantArgs = {
  input: AskTripAssistantInput;
};


export type MutationCancelGroupRideArgs = {
  groupRideId: Scalars['ID']['input'];
};


export type MutationCloneTripArgs = {
  tripId: Scalars['ID']['input'];
};


export type MutationCompleteMaintenanceTaskArgs = {
  createNextOccurrence?: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['String']['input'];
  input?: InputMaybe<CompleteMaintenanceTaskInput>;
};


export type MutationCompleteOnboardingArgs = {
  input: CompleteOnboardingInput;
};


export type MutationCreateBlogCategoryArgs = {
  input: CreateBlogCategoryInput;
};


export type MutationCreateBlogKeywordArgs = {
  input: CreateBlogKeywordInput;
};


export type MutationCreateBlogPostArgs = {
  input: CreateBlogPostInput;
};


export type MutationCreateCommentArgs = {
  input: CreateCommentInput;
};


export type MutationCreateDiagnosticArgs = {
  input: CreateDiagnosticInput;
};


export type MutationCreateDocumentArgs = {
  input: CreateDocumentInput;
};


export type MutationCreateFlagArgs = {
  input: CreateFlagInput;
};


export type MutationCreateFuelLogArgs = {
  input: CreateFuelLogInput;
};


export type MutationCreateGroupRideArgs = {
  input: CreateGroupRideInput;
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


export type MutationCreateTripArgs = {
  input: CreateTripInput;
};


export type MutationCreateTripReviewArgs = {
  input: CreateTripReviewInput;
};


export type MutationCreateTripSuggestionArgs = {
  input: CreateTripSuggestionInput;
};


export type MutationCreateTripWithWaypointsArgs = {
  input: CreateTripWithWaypointsInput;
};


export type MutationDeleteBlogPostArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteCommentArgs = {
  commentId: Scalars['ID']['input'];
};


export type MutationDeleteDocumentArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteDocumentCategoryArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteExpenseArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteExpensePhotoArgs = {
  photoId: Scalars['String']['input'];
};


export type MutationDeleteFuelLogArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteMaintenanceTaskArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteMotorcycleArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteRideArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteTaskPhotoArgs = {
  photoId: Scalars['ID']['input'];
};


export type MutationDeleteTripArgs = {
  tripId: Scalars['ID']['input'];
};


export type MutationDeleteTripReviewArgs = {
  reviewId: Scalars['ID']['input'];
};


export type MutationEndRideArgs = {
  input: EndRideInput;
};


export type MutationExportTripGpxArgs = {
  country: Scalars['String']['input'];
  region: Scalars['String']['input'];
  slug: Scalars['String']['input'];
};


export type MutationFlagCommentArgs = {
  commentId: Scalars['ID']['input'];
};


export type MutationFollowRiderArgs = {
  input: FollowRiderInput;
};


export type MutationGenerateArticleArgs = {
  input: GenerateArticleInput;
};


export type MutationGenerateBikeHealthReportArgs = {
  input: GenerateReportInput;
};


export type MutationGenerateOnboardingInsightsArgs = {
  input: GenerateInsightsInput;
};


export type MutationImportOemScheduleArgs = {
  motorcycleId: Scalars['String']['input'];
};


export type MutationInviteToTripArgs = {
  invitedUserId: Scalars['ID']['input'];
  tripId: Scalars['ID']['input'];
};


export type MutationJoinGroupRideArgs = {
  groupRideId: Scalars['ID']['input'];
};


export type MutationJoinPremiumWaitlistArgs = {
  feature: Scalars['String']['input'];
};


export type MutationJoinTripArgs = {
  input: JoinTripInput;
};


export type MutationJoinWaitlistArgs = {
  email: Scalars['String']['input'];
};


export type MutationLeaveGroupRideArgs = {
  groupRideId: Scalars['ID']['input'];
};


export type MutationLeaveTripArgs = {
  tripId: Scalars['ID']['input'];
};


export type MutationLogExpenseArgs = {
  input: LogExpenseInput;
};


export type MutationMarkArticleReadArgs = {
  articleId: Scalars['String']['input'];
};


export type MutationPublishAsTemplateArgs = {
  tripId: Scalars['ID']['input'];
};


export type MutationPublishBlogPostArgs = {
  id: Scalars['String']['input'];
};


export type MutationPublishTripArgs = {
  tripId: Scalars['ID']['input'];
};


export type MutationRegenerateRideSummaryArgs = {
  rideId: Scalars['String']['input'];
};


export type MutationRemoveWaypointArgs = {
  waypointId: Scalars['ID']['input'];
};


export type MutationReorderWaypointsArgs = {
  input: ReorderWaypointsInput;
};


export type MutationReportSurfaceArgs = {
  input: ReportSurfaceInput;
};


export type MutationRespondToTripInviteArgs = {
  accept: Scalars['Boolean']['input'];
  inviteId: Scalars['ID']['input'];
};


export type MutationRespondToTripSuggestionArgs = {
  input: RespondToTripSuggestionInput;
};


export type MutationRevertBlogPostVersionArgs = {
  id: Scalars['String']['input'];
  versionNum: Scalars['Int']['input'];
};


export type MutationRevokeShareLinkArgs = {
  linkId: Scalars['ID']['input'];
};


export type MutationRotateTripShareTokenArgs = {
  tripId: Scalars['ID']['input'];
};


export type MutationSaveTripArgs = {
  tripId: Scalars['ID']['input'];
};


export type MutationScheduleBlogPostArgs = {
  input: ScheduleBlogPostInput;
};


export type MutationSetTripParticipantRoleArgs = {
  input: SetParticipantRoleInput;
};


export type MutationShareRideArgs = {
  rideId: Scalars['String']['input'];
  sharedWithUserId: Scalars['String']['input'];
};


export type MutationShareRideAsTripArgs = {
  input: ShareRideAsTripInput;
};


export type MutationStartRideArgs = {
  input: StartRideInput;
};


export type MutationSubmitDiagnosticArgs = {
  input: SubmitDiagnosticInput;
};


export type MutationSubmitQuizArgs = {
  input: SubmitQuizInput;
};


export type MutationToggleKudosArgs = {
  rideId: Scalars['String']['input'];
};


export type MutationTrackAffiliateClickArgs = {
  input: TrackClickInput;
};


export type MutationTrackSponsorshipClickArgs = {
  input: TrackSponsorshipClickInput;
};


export type MutationTrackSponsorshipImpressionArgs = {
  input: TrackSponsorshipImpressionInput;
};


export type MutationUnfollowRiderArgs = {
  input: UnfollowRiderInput;
};


export type MutationUnpublishBlogPostArgs = {
  id: Scalars['String']['input'];
};


export type MutationUnpublishTemplateArgs = {
  tripId: Scalars['ID']['input'];
};


export type MutationUnsaveTripArgs = {
  tripId: Scalars['ID']['input'];
};


export type MutationUnshareRideArgs = {
  rideId: Scalars['String']['input'];
  sharedWithUserId: Scalars['String']['input'];
};


export type MutationUpdateBlogPostArgs = {
  input: UpdateBlogPostInput;
};


export type MutationUpdateDocumentArgs = {
  id: Scalars['String']['input'];
  input: UpdateDocumentInput;
};


export type MutationUpdateDocumentCategoryArgs = {
  id: Scalars['String']['input'];
  input: UpdateDocumentCategoryInput;
};


export type MutationUpdateGroupRideArgs = {
  input: UpdateGroupRideInput;
};


export type MutationUpdateHandleArgs = {
  input: UpdateHandleInput;
};


export type MutationUpdateMaintenanceTaskArgs = {
  id: Scalars['String']['input'];
  input: UpdateMaintenanceTaskInput;
};


export type MutationUpdateMotorcycleArgs = {
  id: Scalars['String']['input'];
  input: UpdateMotorcycleInput;
};


export type MutationUpdateMyProfileArgs = {
  input: UpdateProfileInput;
};


export type MutationUpdateParticipantStatusArgs = {
  input: UpdateParticipantStatusInput;
};


export type MutationUpdateRideArgs = {
  input: UpdateRideInput;
};


export type MutationUpdateRideVisibilityArgs = {
  rideId: Scalars['String']['input'];
  visibility: Scalars['String']['input'];
};


export type MutationUpdateTripArgs = {
  input: UpdateTripInput;
};


export type MutationUpdateUserArgs = {
  input: UpdateUserInput;
};


export type MutationUpdateWaypointArgs = {
  input: UpdateWaypointInput;
};


export type MutationUploadWaypointsArgs = {
  input: UploadWaypointsInput;
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

export type OnboardingReveal = {
  __typename?: 'OnboardingReveal';
  insights: RevealInsights;
  make: Scalars['String']['output'];
  model?: Maybe<Scalars['String']['output']>;
  /** Number of OEM scheduled tasks loaded for this bike. */
  oemTaskCount: Scalars['Int']['output'];
  /** Estimated first-year scheduled-service cost in EUR (hedged "about €X"). */
  projectedYearlyCostEur?: Maybe<Scalars['Int']['output']>;
  /** Open recall count. 0 is a positive, reassuring state. */
  recallCount: Scalars['Int']['output'];
  /** Open recalls (capped). Empty when none/unknown. */
  recalls: Array<RevealRecall>;
  /** False when recalls could not be checked (e.g. make-only capture, NHTSA down). */
  recallsChecked: Scalars['Boolean']['output'];
  /** Riders on MotoVault with this make. */
  riderCount: Scalars['Int']['output'];
  /** Year echoed back for client convenience. */
  year: Scalars['Int']['output'];
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['String']['output']>;
};

/** Role of a trip participant. */
export enum ParticipantRole {
  CoPlanner = 'co_planner',
  Organizer = 'organizer',
  Rider = 'rider'
}

/** Period of the day assigned to a waypoint or ride segment. */
export enum PeriodOfDay {
  Afternoon = 'afternoon',
  Evening = 'evening',
  Morning = 'morning'
}

export type PlaceSuggestion = {
  __typename?: 'PlaceSuggestion';
  countryCode: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  kind: Scalars['String']['output'];
  name: Scalars['String']['output'];
  population: Scalars['Int']['output'];
  regionCode?: Maybe<Scalars['String']['output']>;
};

export type PublicRideStats = {
  __typename?: 'PublicRideStats';
  joinDate?: Maybe<Scalars['String']['output']>;
  totalDistance: Scalars['Float']['output'];
  totalRides: Scalars['Int']['output'];
};

export type PublicRiderBike = {
  __typename?: 'PublicRiderBike';
  make: Scalars['String']['output'];
  model: Scalars['String']['output'];
  nickname?: Maybe<Scalars['String']['output']>;
  year: Scalars['Int']['output'];
};

export type PublicRiderProfile = {
  __typename?: 'PublicRiderProfile';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  bikes: Array<PublicRiderBike>;
  bio?: Maybe<Scalars['String']['output']>;
  city?: Maybe<Scalars['String']['output']>;
  displayName?: Maybe<Scalars['String']['output']>;
  followerCount: Scalars['Int']['output'];
  followingCount: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  isFollowing?: Maybe<Scalars['Boolean']['output']>;
  publicUsername: Scalars['String']['output'];
  rideStats: PublicRideStats;
};

export type Query = {
  __typename?: 'Query';
  adminBlogCategories: Array<BlogCategory>;
  adminBlogKeywords: Array<BlogKeyword>;
  adminBlogPost?: Maybe<BlogPost>;
  adminBlogPostVersions: Array<BlogPostVersion>;
  adminBlogPosts: BlogPostConnection;
  aiBudgetStatus: AiBudgetStatus;
  allMaintenanceTasks: Array<MaintenanceTask>;
  articleBySlug?: Maybe<Article>;
  articleBySlugFull?: Maybe<Article>;
  /** All countries in the places taxonomy (browse / explore) */
  browseCountries: Array<BrowsePlace>;
  /** Country by URL slug (lowercase ISO code, e.g. it, de) */
  browseCountryBySlug?: Maybe<BrowsePlace>;
  /** Country + region for /explore/:country/:region marketing pages */
  browseExploreRegion?: Maybe<BrowseExploreRegionResult>;
  /** Regions with population > 0 for a country slug */
  browseRegionsByCountrySlug: Array<BrowsePlace>;
  diagnosticById?: Maybe<Diagnostic>;
  discoverRiderTrips: TripConnection;
  documentCategories: Array<DocumentCategory>;
  documents: Array<Document>;
  expenseDashboard: ExpenseDashboardSummary;
  expensePhotos: Array<ExpensePhoto>;
  expenses: ExpenseSummary;
  expiringDocuments: Array<Document>;
  fuelLogs: Array<FuelLog>;
  fuelStops: Array<FuelStop>;
  fuelStopsNearRoute: FuelRangeResult;
  getComments: CommentConnection;
  getDocumentSignedUrl: Scalars['String']['output'];
  getFollowers: FollowConnection;
  getFollowing: FollowConnection;
  /** Returns current GPX export quota usage and limits for the authenticated user */
  getGPXQuotaStatus: QuotaStatus;
  getGroupRides: GroupRideConnection;
  getMyHealthReports: Array<HealthReport>;
  getPublicRide: Ride;
  getRiderProfile: PublicRiderProfile;
  getTrips: TripConnection;
  groupRideDetail: GroupRide;
  isTripSaved: Scalars['Boolean']['output'];
  kudosList: Array<KudosUser>;
  maintenanceDraftReview: MaintenanceDraftReview;
  maintenanceTaskHistory: Array<MaintenanceTask>;
  maintenanceTasks: Array<MaintenanceTask>;
  /** Aggregated fleet stats per motorcycle make (riders, models, total bikes) */
  makeStats: Array<MakeStats>;
  me: User;
  motorcycleMakes: Array<MotorcycleMake>;
  motorcycleModels: Array<MotorcycleModelResult>;
  motorcycleRecalls: RecallResult;
  myDiagnostics: Array<Diagnostic>;
  myMotorcycles: Array<Motorcycle>;
  myProgress: Array<LearningProgress>;
  myRides: RideConnection;
  myShareLinks: Array<ShareLink>;
  myTrips: TripConnection;
  oemSchedulesForBike: Array<OemSchedule>;
  oemSchedulesPreview: Array<OemSchedule>;
  /** Composed Bike Dossier for the onboarding Reveal (recalls, plan, cost, AI flavor). */
  onboardingReveal: OnboardingReveal;
  popularArticles: Array<Article>;
  /** Public saved trips for a user by handle (public_username) */
  publicSavedTrips: TripConnection;
  quizByArticle?: Maybe<Quiz>;
  ride: Ride;
  rideFeed: FeedRideConnection;
  rideOverview: RideOverview;
  rideWaypoints: Array<Waypoint>;
  routeConditions: RouteConditions;
  routeSponsorships: Array<Sponsorship>;
  savedTrips: TripConnection;
  searchArticles: ArticleConnection;
  searchTypeahead: TypeaheadResult;
  sharedBikeHistory: SharedBikeHistory;
  /** Find similar published trip templates by country + difficulty + duration */
  similarTrips: Array<Trip>;
  /** Published trip templates for XML sitemap generation */
  sitemapPublishedTrips: Array<SitemapTripEntry>;
  spendingSummary: SpendingSummary;
  templateTripIdForRoute?: Maybe<Scalars['ID']['output']>;
  tripByShareToken?: Maybe<SharedTrip>;
  tripBySlug?: Maybe<Trip>;
  tripDetail: Trip;
  tripInvites: Array<TripInvite>;
  /** Get reviews for a trip by ID or by slug (country+region+slug lookup) */
  tripReviews: Array<TripReview>;
  tripSuggestions: Array<TripSuggestion>;
  tripTemplates: TripConnection;
  user: User;
};


export type QueryAdminBlogPostArgs = {
  id: Scalars['String']['input'];
};


export type QueryAdminBlogPostVersionsArgs = {
  id: Scalars['String']['input'];
};


export type QueryAdminBlogPostsArgs = {
  input?: InputMaybe<ListBlogPostsInput>;
};


export type QueryArticleBySlugArgs = {
  slug: Scalars['String']['input'];
};


export type QueryArticleBySlugFullArgs = {
  slug: Scalars['String']['input'];
};


export type QueryBrowseCountryBySlugArgs = {
  slug: Scalars['String']['input'];
};


export type QueryBrowseExploreRegionArgs = {
  countrySlug: Scalars['String']['input'];
  regionSlug: Scalars['String']['input'];
};


export type QueryBrowseRegionsByCountrySlugArgs = {
  countrySlug: Scalars['String']['input'];
};


export type QueryDiagnosticByIdArgs = {
  id: Scalars['String']['input'];
};


export type QueryDiscoverRiderTripsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryDocumentCategoriesArgs = {
  includeHidden?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryDocumentsArgs = {
  motorcycleId: Scalars['String']['input'];
};


export type QueryExpenseDashboardArgs = {
  motorcycleId: Scalars['String']['input'];
};


export type QueryExpensePhotosArgs = {
  expenseId: Scalars['String']['input'];
};


export type QueryExpensesArgs = {
  motorcycleId: Scalars['String']['input'];
  year?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryExpiringDocumentsArgs = {
  withinDays?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryFuelLogsArgs = {
  motorcycleId: Scalars['String']['input'];
};


export type QueryFuelStopsArgs = {
  radiusKm?: InputMaybe<Scalars['Float']['input']>;
  routeId: Scalars['ID']['input'];
};


export type QueryFuelStopsNearRouteArgs = {
  bikeId?: InputMaybe<Scalars['ID']['input']>;
  radiusKm?: InputMaybe<Scalars['Float']['input']>;
  routeId: Scalars['ID']['input'];
};


export type QueryGetCommentsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  groupRideId?: InputMaybe<Scalars['ID']['input']>;
  rideId?: InputMaybe<Scalars['ID']['input']>;
  routeId?: InputMaybe<Scalars['ID']['input']>;
  tripId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryGetDocumentSignedUrlArgs = {
  download?: InputMaybe<Scalars['Boolean']['input']>;
  fileId: Scalars['String']['input'];
};


export type QueryGetFollowersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  userId: Scalars['String']['input'];
};


export type QueryGetFollowingArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  userId: Scalars['String']['input'];
};


export type QueryGetGroupRidesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  nearLat?: InputMaybe<Scalars['Float']['input']>;
  nearLng?: InputMaybe<Scalars['Float']['input']>;
  radiusKm?: InputMaybe<Scalars['Float']['input']>;
};


export type QueryGetPublicRideArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetRiderProfileArgs = {
  username: Scalars['String']['input'];
};


export type QueryGetTripsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryGroupRideDetailArgs = {
  groupRideId: Scalars['ID']['input'];
};


export type QueryIsTripSavedArgs = {
  tripId: Scalars['ID']['input'];
};


export type QueryKudosListArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  rideId: Scalars['String']['input'];
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


export type QueryMotorcycleRecallsArgs = {
  motorcycleId: Scalars['String']['input'];
};


export type QueryMyRidesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  motorcycleId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryMyShareLinksArgs = {
  motorcycleId: Scalars['ID']['input'];
};


export type QueryMyTripsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryOemSchedulesForBikeArgs = {
  motorcycleId: Scalars['String']['input'];
};


export type QueryOemSchedulesPreviewArgs = {
  make: Scalars['String']['input'];
  model?: InputMaybe<Scalars['String']['input']>;
  variant?: InputMaybe<Scalars['String']['input']>;
  year?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryOnboardingRevealArgs = {
  make: Scalars['String']['input'];
  model?: InputMaybe<Scalars['String']['input']>;
  year: Scalars['Int']['input'];
};


export type QueryPopularArticlesArgs = {
  first?: Scalars['Int']['input'];
};


export type QueryPublicSavedTripsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  handle: Scalars['String']['input'];
};


export type QueryQuizByArticleArgs = {
  articleId: Scalars['String']['input'];
};


export type QueryRideArgs = {
  id: Scalars['String']['input'];
};


export type QueryRideFeedArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryRideWaypointsArgs = {
  maxPoints?: InputMaybe<Scalars['Int']['input']>;
  rideId: Scalars['String']['input'];
};


export type QueryRouteConditionsArgs = {
  routeId: Scalars['ID']['input'];
};


export type QueryRouteSponsorshipsArgs = {
  routeId: Scalars['ID']['input'];
};


export type QuerySavedTripsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerySearchArticlesArgs = {
  input: SearchArticlesInput;
};


export type QuerySearchTypeaheadArgs = {
  limit?: Scalars['Int']['input'];
  q?: InputMaybe<Scalars['String']['input']>;
};


export type QuerySharedBikeHistoryArgs = {
  token: Scalars['String']['input'];
};


export type QuerySimilarTripsArgs = {
  country: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  region: Scalars['String']['input'];
  slug: Scalars['String']['input'];
};


export type QuerySpendingSummaryArgs = {
  motorcycleId: Scalars['String']['input'];
};


export type QueryTemplateTripIdForRouteArgs = {
  routeId: Scalars['ID']['input'];
};


export type QueryTripByShareTokenArgs = {
  shareToken: Scalars['String']['input'];
};


export type QueryTripBySlugArgs = {
  country: Scalars['String']['input'];
  region: Scalars['String']['input'];
  slug: Scalars['String']['input'];
};


export type QueryTripDetailArgs = {
  tripId: Scalars['ID']['input'];
};


export type QueryTripInvitesArgs = {
  tripId: Scalars['ID']['input'];
};


export type QueryTripReviewsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  country?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  region?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  tripId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryTripSuggestionsArgs = {
  tripId: Scalars['ID']['input'];
};


export type QueryTripTemplatesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<TripTemplateFilterInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
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

/** Current quota usage for a gated feature */
export type QuotaStatus = {
  __typename?: 'QuotaStatus';
  /** Feature identifier (e.g. gpx_export) */
  feature: Scalars['String']['output'];
  /** True when remaining = 0 (and limit is not unlimited) */
  isExhausted: Scalars['Boolean']['output'];
  /** Monthly limit (-1 = unlimited) */
  limit: Scalars['Int']['output'];
  /** Remaining uses this month (-1 = unlimited) */
  remaining: Scalars['Int']['output'];
  /** ISO date when quota resets (1st of next month) */
  resetDate: Scalars['String']['output'];
  /** Number of uses this month */
  used: Scalars['Int']['output'];
};

export type Recall = {
  __typename?: 'Recall';
  campaignNumber: Scalars['String']['output'];
  component: Scalars['String']['output'];
  consequence: Scalars['String']['output'];
  remedy: Scalars['String']['output'];
  reportDate: Scalars['String']['output'];
  summary: Scalars['String']['output'];
};

export type RecallResult = {
  __typename?: 'RecallResult';
  checkedAt: Scalars['String']['output'];
  count: Scalars['Int']['output'];
  recalls: Array<Recall>;
  vinUsed?: Maybe<Scalars['String']['output']>;
};

export type ReorderWaypointsInput = {
  tripId: Scalars['ID']['input'];
  waypointIds: Array<Scalars['ID']['input']>;
};

export type ReportSurfaceInput = {
  condition: Scalars['String']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  photoUrl?: InputMaybe<Scalars['String']['input']>;
  routeId: Scalars['ID']['input'];
};

export type RespondToTripSuggestionInput = {
  decision: TripSuggestionDecision;
  note?: InputMaybe<Scalars['String']['input']>;
  suggestionId: Scalars['ID']['input'];
};

export type RevealInsights = {
  __typename?: 'RevealInsights';
  /** Hedged community observations. Empty unless status is "ready". */
  knownIssues: Array<RevealKnownIssue>;
  /** Generation status: 'pending' | 'ready' | 'failed'. */
  status: Scalars['String']['output'];
};

export type RevealKnownIssue = {
  __typename?: 'RevealKnownIssue';
  detail: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type RevealRecall = {
  __typename?: 'RevealRecall';
  component: Scalars['String']['output'];
  summary: Scalars['String']['output'];
};

export type Ride = {
  __typename?: 'Ride';
  autoPausedDurationS: Scalars['Int']['output'];
  avgSpeedMps?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['String']['output'];
  distanceM?: Maybe<Scalars['Int']['output']>;
  durationS?: Maybe<Scalars['Int']['output']>;
  elevationGain?: Maybe<Scalars['Float']['output']>;
  elevationLoss?: Maybe<Scalars['Float']['output']>;
  endedAt?: Maybe<Scalars['String']['output']>;
  gpsQuality?: Maybe<Scalars['Float']['output']>;
  id: Scalars['ID']['output'];
  isPublic: Scalars['Boolean']['output'];
  maxLeanAngle?: Maybe<Scalars['Float']['output']>;
  maxSpeedMps?: Maybe<Scalars['Float']['output']>;
  mileageApplied: Scalars['Boolean']['output'];
  motorcycleId?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  pausedDurationS: Scalars['Int']['output'];
  region?: Maybe<Scalars['String']['output']>;
  routePolyline?: Maybe<Scalars['String']['output']>;
  routeThumbnailUri?: Maybe<Scalars['String']['output']>;
  startedAt: Scalars['String']['output'];
  status: RideStatus;
  updatedAt: Scalars['String']['output'];
  userId: Scalars['String']['output'];
  visibility: Scalars['String']['output'];
};

export type RideConnection = {
  __typename?: 'RideConnection';
  edges: Array<RideEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type RideEdge = {
  __typename?: 'RideEdge';
  cursor: Scalars['String']['output'];
  node: Ride;
};

export type RideOverview = {
  __typename?: 'RideOverview';
  currentStreak: Scalars['Int']['output'];
  dailyDistances: Array<DailyDistance>;
  last7Days: RidePeriodSummary;
  last30Days: RidePeriodSummary;
  lastRide?: Maybe<LastRideSummary>;
  personalRecords: Array<RideRecord>;
  thisMonth: RidePeriodSummary;
  thisWeek: RidePeriodSummary;
};

export type RidePeriodSummary = {
  __typename?: 'RidePeriodSummary';
  distanceM: Scalars['Float']['output'];
  durationS: Scalars['Int']['output'];
  rideCount: Scalars['Int']['output'];
};

export type RideRecord = {
  __typename?: 'RideRecord';
  achievedAt: Scalars['String']['output'];
  previousValue?: Maybe<Scalars['Float']['output']>;
  recordType: Scalars['String']['output'];
  rideId?: Maybe<Scalars['String']['output']>;
  unit: Scalars['String']['output'];
  value: Scalars['Float']['output'];
};

/** Current status of a ride */
export enum RideStatus {
  Completed = 'completed',
  Paused = 'paused',
  Recording = 'recording'
}

export type RideSummary = {
  __typename?: 'RideSummary';
  createdAt: Scalars['String']['output'];
  generationStatus: GenerationStatus;
  id: Scalars['ID']['output'];
  locale: Scalars['String']['output'];
  rideId: Scalars['String']['output'];
  summaryText: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type RouteConditions = {
  __typename?: 'RouteConditions';
  aggregates: Array<ConditionAggregate>;
  recentReports: Array<SurfaceReport>;
};

export type RouteSuggestion = {
  __typename?: 'RouteSuggestion';
  countryCode: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  regionCode?: Maybe<Scalars['String']['output']>;
  slug: Scalars['String']['output'];
};

export type ScheduleBlogPostInput = {
  id: Scalars['ID']['input'];
  scheduledFor: Scalars['String']['input'];
};

export type SearchArticlesInput = {
  after?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<ArticleCategory>;
  difficulty?: InputMaybe<ArticleDifficulty>;
  first?: InputMaybe<Scalars['Int']['input']>;
  query?: InputMaybe<Scalars['String']['input']>;
};

export type SetParticipantRoleInput = {
  role: ParticipantRole;
  tripId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
};

export type ShareLink = {
  __typename?: 'ShareLink';
  createdAt: Scalars['String']['output'];
  expiresAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  motorcycleId: Scalars['String']['output'];
  token?: Maybe<Scalars['String']['output']>;
  url?: Maybe<Scalars['String']['output']>;
};

export type ShareRideAsTripInput = {
  name?: InputMaybe<Scalars['String']['input']>;
  rideId: Scalars['ID']['input'];
  surfaceType?: InputMaybe<Scalars['String']['input']>;
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

export type SharedTrip = {
  __typename?: 'SharedTrip';
  coverImageUrl?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  difficulty: Scalars['String']['output'];
  endDate: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  maxRiders: Scalars['Int']['output'];
  participantCount: Scalars['Int']['output'];
  participants: Array<SharedTripParticipant>;
  startDate: Scalars['String']['output'];
  status: Scalars['String']['output'];
  title: Scalars['String']['output'];
  waypoints: Array<SharedTripWaypoint>;
};

export type SharedTripParticipant = {
  __typename?: 'SharedTripParticipant';
  anonId: Scalars['String']['output'];
  avatarUrl?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  role: Scalars['String']['output'];
  status: Scalars['String']['output'];
};

export type SharedTripWaypoint = {
  __typename?: 'SharedTripWaypoint';
  dayIndex?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  lat: Scalars['Float']['output'];
  lng: Scalars['Float']['output'];
  name: Scalars['String']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  periodOfDay?: Maybe<PeriodOfDay>;
  sortOrder: Scalars['Int']['output'];
  type: Scalars['String']['output'];
};

/** Minimal trip data for XML sitemap generation */
export type SitemapTripEntry = {
  __typename?: 'SitemapTripEntry';
  countryCode: Scalars['String']['output'];
  regionCode: Scalars['String']['output'];
  slug: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type SpendingSummary = {
  __typename?: 'SpendingSummary';
  allTime: Scalars['Float']['output'];
  thisYear: Scalars['Float']['output'];
};

export type Sponsorship = {
  __typename?: 'Sponsorship';
  clicksCount: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  ctaText?: Maybe<Scalars['String']['output']>;
  ctaUrl?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  endsAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  impressionsCount: Scalars['Int']['output'];
  placementType: SponsorshipPlacementType;
  routeId: Scalars['ID']['output'];
  sponsorId: Scalars['ID']['output'];
  startsAt: Scalars['DateTime']['output'];
  status: SponsorshipStatus;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

/** Visual placement type for a sponsored slot */
export enum SponsorshipPlacementType {
  Banner = 'banner',
  Card = 'card',
  Pin = 'pin'
}

/** Status of a sponsorship slot */
export enum SponsorshipStatus {
  Active = 'active',
  Deactivated = 'deactivated',
  Expired = 'expired',
  Paused = 'paused'
}

export type StartRideInput = {
  motorcycleId?: InputMaybe<Scalars['String']['input']>;
  rideId: Scalars['String']['input'];
  startedAt: Scalars['String']['input'];
};

export type SubmitDiagnosticInput = {
  additionalNotes?: InputMaybe<Scalars['String']['input']>;
  dataSharingOptedIn?: Scalars['Boolean']['input'];
  freeTextDescription?: InputMaybe<Scalars['String']['input']>;
  includeMaintenanceHistory?: Scalars['Boolean']['input'];
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

export type SurfaceReport = {
  __typename?: 'SurfaceReport';
  condition: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  note?: Maybe<Scalars['String']['output']>;
  photoUrl?: Maybe<Scalars['String']['output']>;
  reportedAt: Scalars['String']['output'];
  routeId: Scalars['ID']['output'];
  userId: Scalars['ID']['output'];
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

export type TrackClickInput = {
  diagnosisType?: InputMaybe<Scalars['String']['input']>;
  partner: AffiliatePartner;
  productUrl: Scalars['String']['input'];
};

export type TrackSponsorshipClickInput = {
  sponsorshipId: Scalars['ID']['input'];
};

export type TrackSponsorshipImpressionInput = {
  sponsorshipId: Scalars['ID']['input'];
};

export type TriggeredMaintenanceTask = {
  __typename?: 'TriggeredMaintenanceTask';
  id: Scalars['String']['output'];
  priority: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type Trip = {
  __typename?: 'Trip';
  averageRating?: Maybe<Scalars['Float']['output']>;
  city?: Maybe<Scalars['String']['output']>;
  cloneCount: Scalars['Int']['output'];
  clonedFromTripId?: Maybe<Scalars['ID']['output']>;
  countryCode?: Maybe<Scalars['String']['output']>;
  coverImageUrl?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  curvatureIndex?: Maybe<Scalars['Float']['output']>;
  datesPending?: Maybe<Scalars['Boolean']['output']>;
  dayCount?: Maybe<Scalars['Int']['output']>;
  description: Scalars['String']['output'];
  difficulty: Scalars['String']['output'];
  distanceM?: Maybe<Scalars['Int']['output']>;
  elevationGainM?: Maybe<Scalars['Int']['output']>;
  endDate: Scalars['String']['output'];
  estimatedDurationMinutes?: Maybe<Scalars['Int']['output']>;
  forkedFromTripId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  isFeatured: Scalars['Boolean']['output'];
  isFlagged: Scalars['Boolean']['output'];
  isMotovaultPick: Scalars['Boolean']['output'];
  isSaved?: Maybe<Scalars['Boolean']['output']>;
  isTemplate: Scalars['Boolean']['output'];
  maxRiders: Scalars['Int']['output'];
  organiser: TripOrganiser;
  participantCount: Scalars['Int']['output'];
  participants?: Maybe<Array<TripParticipant>>;
  polyline?: Maybe<Scalars['String']['output']>;
  publishedAt?: Maybe<Scalars['String']['output']>;
  regionCode?: Maybe<Scalars['String']['output']>;
  reviewCount: Scalars['Int']['output'];
  reviews?: Maybe<Array<TripReview>>;
  slug?: Maybe<Scalars['String']['output']>;
  startDate: Scalars['String']['output'];
  startLat?: Maybe<Scalars['Float']['output']>;
  startLng?: Maybe<Scalars['Float']['output']>;
  status: Scalars['String']['output'];
  surfaceType?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  updatedAt?: Maybe<Scalars['String']['output']>;
  viewCount: Scalars['Int']['output'];
  visibility: Scalars['String']['output'];
  waypoints?: Maybe<Array<TripWaypoint>>;
};

export type TripAssistantHistoryMessage = {
  content: Scalars['String']['input'];
  role: AssistantMessageRole;
};

export type TripAssistantMessage = {
  __typename?: 'TripAssistantMessage';
  message: Scalars['String']['output'];
};

export type TripConnection = {
  __typename?: 'TripConnection';
  edges: Array<TripEdge>;
  pageInfo: TripPageInfo;
};

export type TripEdge = {
  __typename?: 'TripEdge';
  cursor: Scalars['String']['output'];
  node: Trip;
};

export type TripInvite = {
  __typename?: 'TripInvite';
  acceptedAt?: Maybe<Scalars['String']['output']>;
  declinedAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  invitedAt: Scalars['String']['output'];
  invitedUserId: Scalars['String']['output'];
};

export type TripOrganiser = {
  __typename?: 'TripOrganiser';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  publicUsername?: Maybe<Scalars['String']['output']>;
};

export type TripPageInfo = {
  __typename?: 'TripPageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
};

export type TripParticipant = {
  __typename?: 'TripParticipant';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  bikeId?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  joinedAt: Scalars['String']['output'];
  publicUsername?: Maybe<Scalars['String']['output']>;
  role: Scalars['String']['output'];
  status: Scalars['String']['output'];
};

export type TripReview = {
  __typename?: 'TripReview';
  author?: Maybe<TripReviewAuthor>;
  bike?: Maybe<TripReviewBike>;
  bikeId?: Maybe<Scalars['String']['output']>;
  conditionTags?: Maybe<Array<Scalars['String']['output']>>;
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  rating: Scalars['Int']['output'];
  text?: Maybe<Scalars['String']['output']>;
  tripId: Scalars['ID']['output'];
  userId?: Maybe<Scalars['ID']['output']>;
};

export type TripReviewAuthor = {
  __typename?: 'TripReviewAuthor';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  publicUsername?: Maybe<Scalars['String']['output']>;
};

export type TripReviewBike = {
  __typename?: 'TripReviewBike';
  make: Scalars['String']['output'];
  model: Scalars['String']['output'];
  type?: Maybe<Scalars['String']['output']>;
  year: Scalars['Int']['output'];
};

export type TripSuggestion = {
  __typename?: 'TripSuggestion';
  author: TripSuggestionAuthor;
  createdAt: Scalars['String']['output'];
  dayIndex?: Maybe<Scalars['Int']['output']>;
  decidedAt?: Maybe<Scalars['String']['output']>;
  decidedBy?: Maybe<Scalars['String']['output']>;
  decidedNote?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  kind: TripSuggestionKind;
  lat?: Maybe<Scalars['Float']['output']>;
  lng?: Maybe<Scalars['Float']['output']>;
  name: Scalars['String']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  periodOfDay?: Maybe<PeriodOfDay>;
  status: TripSuggestionStatus;
  tripId: Scalars['ID']['output'];
  waypointId?: Maybe<Scalars['String']['output']>;
};

export type TripSuggestionAuthor = {
  __typename?: 'TripSuggestionAuthor';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  publicUsername?: Maybe<Scalars['String']['output']>;
};

/** Decision applied to a pending trip suggestion. */
export enum TripSuggestionDecision {
  Accepted = 'accepted',
  Rejected = 'rejected',
  Withdrawn = 'withdrawn'
}

/** Kind of a trip suggestion (waypoint or note). */
export enum TripSuggestionKind {
  Note = 'note',
  Waypoint = 'waypoint'
}

/** Lifecycle of a trip suggestion. */
export enum TripSuggestionStatus {
  Accepted = 'accepted',
  Pending = 'pending',
  Rejected = 'rejected',
  Withdrawn = 'withdrawn'
}

export type TripTemplateFilterInput = {
  country?: InputMaybe<Scalars['String']['input']>;
  dayCountMax?: InputMaybe<Scalars['Int']['input']>;
  dayCountMin?: InputMaybe<Scalars['Int']['input']>;
  difficulty?: InputMaybe<Scalars['String']['input']>;
  searchText?: InputMaybe<Scalars['String']['input']>;
  surfaceType?: InputMaybe<Scalars['String']['input']>;
};

export type TripWaypoint = {
  __typename?: 'TripWaypoint';
  createdAt: Scalars['String']['output'];
  dayIndex: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  lat: Scalars['Float']['output'];
  lng: Scalars['Float']['output'];
  name: Scalars['String']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  periodOfDay?: Maybe<PeriodOfDay>;
  sortOrder: Scalars['Int']['output'];
  tripId: Scalars['ID']['output'];
  type: Scalars['String']['output'];
};

export type TypeaheadResult = {
  __typename?: 'TypeaheadResult';
  places: Array<PlaceSuggestion>;
  routes: Array<RouteSuggestion>;
};

export type UnfollowRiderInput = {
  targetUserId: Scalars['String']['input'];
};

export type UpdateBlogPostInput = {
  author?: InputMaybe<Scalars['String']['input']>;
  categoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  coverAlt?: InputMaybe<Scalars['String']['input']>;
  coverImage?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isSafetyCritical?: InputMaybe<Scalars['Boolean']['input']>;
  keywordIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  specData?: InputMaybe<Scalars['Boolean']['input']>;
  translations?: InputMaybe<Array<BlogTranslationInput>>;
  typeData?: InputMaybe<Scalars['JSON']['input']>;
};

export type UpdateDocumentCategoryInput = {
  isHidden?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateDocumentInput = {
  categoryId?: InputMaybe<Scalars['String']['input']>;
  expiryDate?: InputMaybe<Scalars['String']['input']>;
  isPinned?: InputMaybe<Scalars['Boolean']['input']>;
  note?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateGroupRideInput = {
  dateTime?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  groupRideId: Scalars['ID']['input'];
  maxRiders?: InputMaybe<Scalars['Int']['input']>;
  meetingPointLat?: InputMaybe<Scalars['Float']['input']>;
  meetingPointLng?: InputMaybe<Scalars['Float']['input']>;
  meetingPointName?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateHandleInput = {
  handle: Scalars['String']['input'];
};

export type UpdateMaintenanceTaskInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  dueDate?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  partsNeeded?: InputMaybe<Array<Scalars['String']['input']>>;
  priority?: InputMaybe<MaintenancePriority>;
  remind1d?: InputMaybe<Scalars['Boolean']['input']>;
  remind7d?: InputMaybe<Scalars['Boolean']['input']>;
  remind30d?: InputMaybe<Scalars['Boolean']['input']>;
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
  purchaseDate?: InputMaybe<Scalars['String']['input']>;
  purchasePrice?: InputMaybe<Scalars['Float']['input']>;
  variant?: InputMaybe<Scalars['String']['input']>;
  vin?: InputMaybe<Scalars['String']['input']>;
  year?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateParticipantStatusInput = {
  status: Scalars['String']['input'];
  tripId: Scalars['ID']['input'];
};

export type UpdateProfileInput = {
  bio?: InputMaybe<Scalars['String']['input']>;
  city?: InputMaybe<Scalars['String']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  publicUsername?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateRideInput = {
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  mileageApplied?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  rideId: Scalars['String']['input'];
};

export type UpdateTripInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  difficulty?: InputMaybe<Scalars['String']['input']>;
  endDate?: InputMaybe<Scalars['String']['input']>;
  maxRiders?: InputMaybe<Scalars['Int']['input']>;
  startDate?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
  tripId: Scalars['ID']['input'];
  visibility?: InputMaybe<Scalars['String']['input']>;
  waypoints?: InputMaybe<Array<InlineWaypointInput>>;
};

export type UpdateUserInput = {
  currency?: InputMaybe<Scalars['String']['input']>;
  fullName?: InputMaybe<Scalars['String']['input']>;
  measurementSystem?: InputMaybe<Scalars['String']['input']>;
  preferences?: InputMaybe<Scalars['JSON']['input']>;
};

export type UpdateWaypointInput = {
  dayIndex?: InputMaybe<Scalars['Int']['input']>;
  lat?: InputMaybe<Scalars['Float']['input']>;
  lng?: InputMaybe<Scalars['Float']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  periodOfDay?: InputMaybe<PeriodOfDay>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  type?: InputMaybe<Scalars['String']['input']>;
  waypointId: Scalars['ID']['input'];
};

export type UploadWaypointsInput = {
  rideId: Scalars['String']['input'];
  waypoints: Array<WaypointInput>;
};

/** User-reported urgency level for diagnostic requests */
export enum Urgency {
  Preventive = 'preventive',
  Soon = 'soon',
  Stranded = 'stranded'
}

export type User = {
  __typename?: 'User';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  bio?: Maybe<Scalars['String']['output']>;
  city?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  currency: Scalars['String']['output'];
  displayName?: Maybe<Scalars['String']['output']>;
  email: Scalars['String']['output'];
  followerCount?: Maybe<Scalars['Float']['output']>;
  followingCount?: Maybe<Scalars['Float']['output']>;
  fullName?: Maybe<Scalars['String']['output']>;
  handle?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isPublic?: Maybe<Scalars['Boolean']['output']>;
  measurementSystem?: Maybe<Scalars['String']['output']>;
  preferences?: Maybe<Scalars['JSON']['output']>;
  publicUsername?: Maybe<Scalars['String']['output']>;
  role: UserRole;
  showSavedPublicly?: Maybe<Scalars['Boolean']['output']>;
  subscriptionTier?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['String']['output'];
};

export enum UserRole {
  Admin = 'admin',
  User = 'user'
}

export type Waypoint = {
  __typename?: 'Waypoint';
  accuracy?: Maybe<Scalars['Float']['output']>;
  altitude?: Maybe<Scalars['Float']['output']>;
  latitude: Scalars['Float']['output'];
  longitude: Scalars['Float']['output'];
  recordedAt: Scalars['String']['output'];
  speedMps?: Maybe<Scalars['Float']['output']>;
};

export type WaypointInput = {
  accuracy?: InputMaybe<Scalars['Float']['input']>;
  altitude?: InputMaybe<Scalars['Float']['input']>;
  heading?: InputMaybe<Scalars['Float']['input']>;
  latitude: Scalars['Float']['input'];
  longitude: Scalars['Float']['input'];
  recordedAt: Scalars['String']['input'];
  speedMps?: InputMaybe<Scalars['Float']['input']>;
};

export type AddDocumentCategoryMutationVariables = Exact<{
  input: AddDocumentCategoryInput;
}>;


export type AddDocumentCategoryMutation = { __typename?: 'Mutation', addDocumentCategory: { __typename?: 'DocumentCategory', id: string, name: string, kind: string, isHidden: boolean, promptsExpiry: boolean, createdAt: string, updatedAt: string } };

export type AddExpensePhotoMutationVariables = Exact<{
  input: AddExpensePhotoInput;
}>;


export type AddExpensePhotoMutation = { __typename?: 'Mutation', addExpensePhoto: { __typename?: 'ExpensePhoto', id: string, expenseId: string, storagePath: string, publicUrl: string, fileSizeBytes?: number | null, mimeType: string, createdAt: string } };

export type AddTaskPhotoMutationVariables = Exact<{
  input: AddTaskPhotoInput;
}>;


export type AddTaskPhotoMutation = { __typename?: 'Mutation', addTaskPhoto: { __typename?: 'TaskPhoto', id: string, taskId: string, storagePath: string, publicUrl: string, fileSizeBytes?: number | null, mimeType: string, createdAt: string } };

export type AddWaypointMutationVariables = Exact<{
  input: CreateWaypointInput;
}>;


export type AddWaypointMutation = { __typename?: 'Mutation', addWaypoint: { __typename?: 'TripWaypoint', id: string, tripId: string, sortOrder: number, dayIndex: number, periodOfDay?: PeriodOfDay | null, type: string, name: string, notes?: string | null, lat: number, lng: number, createdAt: string } };

export type AskTripAssistantMutationVariables = Exact<{
  input: AskTripAssistantInput;
}>;


export type AskTripAssistantMutation = { __typename?: 'Mutation', askTripAssistant: { __typename?: 'TripAssistantMessage', message: string } };

export type CancelGroupRideMutationVariables = Exact<{
  groupRideId: Scalars['ID']['input'];
}>;


export type CancelGroupRideMutation = { __typename?: 'Mutation', cancelGroupRide: boolean };

export type CloneTripMutationVariables = Exact<{
  tripId: Scalars['ID']['input'];
}>;


export type CloneTripMutation = { __typename?: 'Mutation', cloneTrip: string };

export type CompleteMaintenanceTaskMutationVariables = Exact<{
  id: Scalars['String']['input'];
  input?: InputMaybe<CompleteMaintenanceTaskInput>;
  createNextOccurrence?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type CompleteMaintenanceTaskMutation = { __typename?: 'Mutation', completeMaintenanceTask: { __typename?: 'CompleteTaskResult', completed: { __typename?: 'MaintenanceTask', id: string, status: MaintenanceTaskStatus, completedAt?: string | null, completedMileage?: number | null, cost?: number | null, partsCost?: number | null, laborCost?: number | null, currency?: string | null }, nextOccurrence?: { __typename?: 'MaintenanceTask', id: string, title: string, description?: string | null, dueDate?: string | null, targetMileage?: number | null, priority: MaintenancePriority, status: MaintenanceTaskStatus, isRecurring: boolean, intervalKm?: number | null, intervalDays?: number | null, source: MaintenanceTaskSource, motorcycleId: string, createdAt: string } | null } };

export type CompleteOnboardingMutationVariables = Exact<{
  input: CompleteOnboardingInput;
}>;


export type CompleteOnboardingMutation = { __typename?: 'Mutation', completeOnboarding: { __typename?: 'User', id: string, preferences?: Record<string, unknown> | null, currency: string, createdAt: string, updatedAt: string } };

export type CreateCommentMutationVariables = Exact<{
  input: CreateCommentInput;
}>;


export type CreateCommentMutation = { __typename?: 'Mutation', createComment: { __typename?: 'Comment', id: string, text: string, createdAt: string, flaggedCount: number, parentCommentId?: string | null, author: { __typename?: 'CommentAuthor', id: string, displayName: string, publicUsername?: string | null, avatarUrl?: string | null } } };

export type CreateDiagnosticMutationVariables = Exact<{
  input: CreateDiagnosticInput;
}>;


export type CreateDiagnosticMutation = { __typename?: 'Mutation', createDiagnostic: { __typename?: 'Diagnostic', id: string, userId: string, motorcycleId?: string | null, severity?: DiagnosticSeverity | null, confidence?: number | null, relatedArticleId?: string | null, status: string, dataSharingOptedIn: boolean, createdAt: string } };

export type CreateDocumentMutationVariables = Exact<{
  input: CreateDocumentInput;
}>;


export type CreateDocumentMutation = { __typename?: 'Mutation', createDocument: { __typename?: 'Document', id: string, motorcycleId: string, categoryId: string, title: string, expiryDate?: string | null, note?: string | null, isPinned: boolean, createdAt: string, updatedAt: string, files: Array<{ __typename?: 'DocumentFile', id: string, documentId: string, mimeType: string, fileSizeBytes?: number | null, createdAt: string }> } };

export type CreateFlagMutationVariables = Exact<{
  input: CreateFlagInput;
}>;


export type CreateFlagMutation = { __typename?: 'Mutation', createFlag: { __typename?: 'ContentFlag', id: string, articleId: string, userId: string, sectionReference?: string | null, comment: string, status: FlagStatus, createdAt: string } };

export type CreateFuelLogMutationVariables = Exact<{
  input: CreateFuelLogInput;
}>;


export type CreateFuelLogMutation = { __typename?: 'Mutation', createFuelLog: { __typename?: 'FuelLog', id: string, odometerKm: number, fuelLitres: number, totalCost?: number | null, currency: string, fuelType: string, isPartial: boolean, filledAt: string, litresPer100Km?: number | null, mpgUs?: number | null } };

export type CreateGroupRideMutationVariables = Exact<{
  input: CreateGroupRideInput;
}>;


export type CreateGroupRideMutation = { __typename?: 'Mutation', createGroupRide: { __typename?: 'GroupRide', id: string, title: string } };

export type CreateMaintenanceTaskMutationVariables = Exact<{
  input: CreateMaintenanceTaskInput;
}>;


export type CreateMaintenanceTaskMutation = { __typename?: 'Mutation', createMaintenanceTask: { __typename?: 'MaintenanceTask', id: string, title: string, priority: MaintenancePriority, status: MaintenanceTaskStatus, dueDate?: string | null, targetMileage?: number | null, isRecurring: boolean, intervalKm?: number | null, intervalDays?: number | null, remind30d: boolean, remind7d: boolean, remind1d: boolean, createdAt: string } };

export type CreateMotorcycleMutationVariables = Exact<{
  input: CreateMotorcycleInput;
}>;


export type CreateMotorcycleMutation = { __typename?: 'Mutation', createMotorcycle: { __typename?: 'Motorcycle', id: string, make: string, model: string, year: number, nickname?: string | null, variant?: string | null, isPrimary: boolean, createdAt: string } };

export type CreateShareLinkMutationVariables = Exact<{
  input: CreateShareLinkInput;
}>;


export type CreateShareLinkMutation = { __typename?: 'Mutation', createShareLink: { __typename?: 'ShareLink', id: string, token?: string | null, motorcycleId: string, expiresAt: string, createdAt: string, url?: string | null } };

export type CreateTripReviewMutationVariables = Exact<{
  input: CreateTripReviewInput;
}>;


export type CreateTripReviewMutation = { __typename?: 'Mutation', createTripReview: { __typename?: 'TripReview', id: string, rating: number, text?: string | null, conditionTags?: Array<string> | null, createdAt: string, tripId: string, userId?: string | null, bikeId?: string | null } };

export type CreateTripSuggestionMutationVariables = Exact<{
  input: CreateTripSuggestionInput;
}>;


export type CreateTripSuggestionMutation = { __typename?: 'Mutation', createTripSuggestion: { __typename?: 'TripSuggestion', id: string, tripId: string, status: TripSuggestionStatus, name: string, notes?: string | null, lat?: number | null, lng?: number | null, dayIndex?: number | null, periodOfDay?: PeriodOfDay | null, createdAt: string, author: { __typename?: 'TripSuggestionAuthor', id: string, displayName: string, avatarUrl?: string | null } } };

export type CreateTripWithWaypointsMutationVariables = Exact<{
  input: CreateTripWithWaypointsInput;
}>;


export type CreateTripWithWaypointsMutation = { __typename?: 'Mutation', createTripWithWaypoints: { __typename?: 'Trip', id: string, title: string, description: string, startDate: string, endDate: string, datesPending?: boolean | null, difficulty: string, maxRiders: number, status: string, visibility: string, createdAt: string, organiser: { __typename?: 'TripOrganiser', id: string, displayName: string }, waypoints?: Array<{ __typename?: 'TripWaypoint', id: string, tripId: string, sortOrder: number, dayIndex: number, periodOfDay?: PeriodOfDay | null, type: string, name: string, notes?: string | null, lat: number, lng: number }> | null } };

export type CreateTripMutationVariables = Exact<{
  input: CreateTripInput;
}>;


export type CreateTripMutation = { __typename?: 'Mutation', createTrip: { __typename?: 'Trip', id: string, title: string, description: string, startDate: string, endDate: string, difficulty: string, maxRiders: number, status: string, createdAt: string, organiser: { __typename?: 'TripOrganiser', id: string, displayName: string } } };

export type DeleteAccountMutationVariables = Exact<{ [key: string]: never; }>;


export type DeleteAccountMutation = { __typename?: 'Mutation', deleteAccount: boolean };

export type DeleteCommentMutationVariables = Exact<{
  commentId: Scalars['ID']['input'];
}>;


export type DeleteCommentMutation = { __typename?: 'Mutation', deleteComment: boolean };

export type DeleteDocumentCategoryMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteDocumentCategoryMutation = { __typename?: 'Mutation', deleteDocumentCategory: boolean };

export type DeleteDocumentMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteDocumentMutation = { __typename?: 'Mutation', deleteDocument: boolean };

export type DeleteExpensePhotoMutationVariables = Exact<{
  photoId: Scalars['String']['input'];
}>;


export type DeleteExpensePhotoMutation = { __typename?: 'Mutation', deleteExpensePhoto: boolean };

export type DeleteExpenseMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteExpenseMutation = { __typename?: 'Mutation', deleteExpense: boolean };

export type DeleteFuelLogMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteFuelLogMutation = { __typename?: 'Mutation', deleteFuelLog: boolean };

export type DeleteMaintenanceTaskMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteMaintenanceTaskMutation = { __typename?: 'Mutation', deleteMaintenanceTask: boolean };

export type DeleteMotorcycleMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteMotorcycleMutation = { __typename?: 'Mutation', deleteMotorcycle: boolean };

export type DeleteRideMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteRideMutation = { __typename?: 'Mutation', deleteRide: boolean };

export type DeleteTaskPhotoMutationVariables = Exact<{
  photoId: Scalars['ID']['input'];
}>;


export type DeleteTaskPhotoMutation = { __typename?: 'Mutation', deleteTaskPhoto: boolean };

export type DeleteTripReviewMutationVariables = Exact<{
  reviewId: Scalars['ID']['input'];
}>;


export type DeleteTripReviewMutation = { __typename?: 'Mutation', deleteTripReview: boolean };

export type DeleteTripMutationVariables = Exact<{
  tripId: Scalars['ID']['input'];
}>;


export type DeleteTripMutation = { __typename?: 'Mutation', deleteTrip: boolean };

export type EndRideMutationVariables = Exact<{
  input: EndRideInput;
}>;


export type EndRideMutation = { __typename?: 'Mutation', endRide: { __typename?: 'EndRideResponse', ride: { __typename?: 'Ride', id: string, status: RideStatus, endedAt?: string | null, distanceM?: number | null, maxSpeedMps?: number | null, avgSpeedMps?: number | null, elevationGain?: number | null, elevationLoss?: number | null, pausedDurationS: number, autoPausedDurationS: number, gpsQuality?: number | null, routePolyline?: string | null, mileageApplied: boolean }, triggeredMaintenanceTasks: Array<{ __typename?: 'TriggeredMaintenanceTask', id: string, title: string, priority: string }> } };

export type ExportTripGpxMutationVariables = Exact<{
  slug: Scalars['String']['input'];
  country: Scalars['String']['input'];
  region: Scalars['String']['input'];
}>;


export type ExportTripGpxMutation = { __typename?: 'Mutation', exportTripGPX: { __typename?: 'GPXExportError', code: string, reason: string, quotaRemaining?: number | null, upgradeUrl?: string | null } | { __typename?: 'GPXExportSuccess', fileUrl: string, fileName: string, message: string } };

export type FlagCommentMutationVariables = Exact<{
  commentId: Scalars['ID']['input'];
}>;


export type FlagCommentMutation = { __typename?: 'Mutation', flagComment: boolean };

export type FollowRiderMutationVariables = Exact<{
  input: FollowRiderInput;
}>;


export type FollowRiderMutation = { __typename?: 'Mutation', followRider: { __typename?: 'Follow', followerId: string, followingId: string, createdAt: string } };

export type GenerateArticleMutationVariables = Exact<{
  input: GenerateArticleInput;
}>;


export type GenerateArticleMutation = { __typename?: 'Mutation', generateArticle: { __typename?: 'Article', id: string, slug: string, title: string, difficulty: ArticleDifficulty, category: ArticleCategory, contentJson?: Record<string, unknown> | null, readTime?: number | null, generatedAt: string } };

export type GenerateBikeHealthReportMutationVariables = Exact<{
  input: GenerateReportInput;
}>;


export type GenerateBikeHealthReportMutation = { __typename?: 'Mutation', generateBikeHealthReport: { __typename?: 'HealthReport', id: string, userId: string, motorcycleId?: string | null, status: HealthReportStatus, pdfUrl?: string | null, iapTransactionId?: string | null, createdAt: string, completedAt?: string | null } };

export type GenerateOnboardingInsightsMutationVariables = Exact<{
  input: GenerateInsightsInput;
}>;


export type GenerateOnboardingInsightsMutation = { __typename?: 'Mutation', generateOnboardingInsights: Array<{ __typename?: 'OnboardingInsight', icon: string, title: string, body: string, type: InsightType }> };

export type ImportOemScheduleMutationVariables = Exact<{
  motorcycleId: Scalars['String']['input'];
}>;


export type ImportOemScheduleMutation = { __typename?: 'Mutation', importOemSchedule: number };

export type InviteToTripMutationVariables = Exact<{
  tripId: Scalars['ID']['input'];
  invitedUserId: Scalars['ID']['input'];
}>;


export type InviteToTripMutation = { __typename?: 'Mutation', inviteToTrip: boolean };

export type JoinGroupRideMutationVariables = Exact<{
  groupRideId: Scalars['ID']['input'];
}>;


export type JoinGroupRideMutation = { __typename?: 'Mutation', joinGroupRide: boolean };

export type JoinPremiumWaitlistMutationVariables = Exact<{
  feature: Scalars['String']['input'];
}>;


export type JoinPremiumWaitlistMutation = { __typename?: 'Mutation', joinPremiumWaitlist: boolean };

export type JoinTripMutationVariables = Exact<{
  input: JoinTripInput;
}>;


export type JoinTripMutation = { __typename?: 'Mutation', joinTrip: boolean };

export type LeaveGroupRideMutationVariables = Exact<{
  groupRideId: Scalars['ID']['input'];
}>;


export type LeaveGroupRideMutation = { __typename?: 'Mutation', leaveGroupRide: boolean };

export type LeaveTripMutationVariables = Exact<{
  tripId: Scalars['ID']['input'];
}>;


export type LeaveTripMutation = { __typename?: 'Mutation', leaveTrip: boolean };

export type LogExpenseMutationVariables = Exact<{
  input: LogExpenseInput;
}>;


export type LogExpenseMutation = { __typename?: 'Mutation', logExpense: { __typename?: 'Expense', id: string, amount: number, category: string, currency: string, description?: string | null, itemName?: string | null, date: string, createdAt: string } };

export type MarkArticleReadMutationVariables = Exact<{
  articleId: Scalars['String']['input'];
}>;


export type MarkArticleReadMutation = { __typename?: 'Mutation', markArticleRead: { __typename?: 'LearningProgress', id: string, userId: string, articleId: string, articleRead: boolean, quizCompleted: boolean, quizBestScore?: number | null, firstReadAt?: string | null, lastReadAt?: string | null } };

export type PublishAsTemplateMutationVariables = Exact<{
  tripId: Scalars['ID']['input'];
}>;


export type PublishAsTemplateMutation = { __typename?: 'Mutation', publishAsTemplate: { __typename?: 'Trip', id: string, slug?: string | null, isTemplate: boolean, publishedAt?: string | null, status: string } };

export type PublishTripMutationVariables = Exact<{
  tripId: Scalars['ID']['input'];
}>;


export type PublishTripMutation = { __typename?: 'Mutation', publishTrip: { __typename?: 'Trip', id: string, status: string } };

export type RegenerateRideSummaryMutationVariables = Exact<{
  rideId: Scalars['String']['input'];
}>;


export type RegenerateRideSummaryMutation = { __typename?: 'Mutation', regenerateRideSummary: { __typename?: 'RideSummary', id: string, rideId: string, summaryText: string, generationStatus: GenerationStatus, locale: string, createdAt: string, updatedAt: string } };

export type RemoveWaypointMutationVariables = Exact<{
  waypointId: Scalars['ID']['input'];
}>;


export type RemoveWaypointMutation = { __typename?: 'Mutation', removeWaypoint: boolean };

export type ReorderWaypointsMutationVariables = Exact<{
  input: ReorderWaypointsInput;
}>;


export type ReorderWaypointsMutation = { __typename?: 'Mutation', reorderWaypoints: boolean };

export type RequestDataExportMutationVariables = Exact<{ [key: string]: never; }>;


export type RequestDataExportMutation = { __typename?: 'Mutation', requestDataExport: { __typename?: 'DataExportRequest', id: string, status: string, requestedAt: string } };

export type RespondToTripInviteMutationVariables = Exact<{
  inviteId: Scalars['ID']['input'];
  accept: Scalars['Boolean']['input'];
}>;


export type RespondToTripInviteMutation = { __typename?: 'Mutation', respondToTripInvite: boolean };

export type RespondToTripSuggestionMutationVariables = Exact<{
  input: RespondToTripSuggestionInput;
}>;


export type RespondToTripSuggestionMutation = { __typename?: 'Mutation', respondToTripSuggestion: { __typename?: 'TripSuggestion', id: string, status: TripSuggestionStatus, decidedBy?: string | null, decidedAt?: string | null, decidedNote?: string | null, waypointId?: string | null } };

export type RevokeShareLinkMutationVariables = Exact<{
  linkId: Scalars['ID']['input'];
}>;


export type RevokeShareLinkMutation = { __typename?: 'Mutation', revokeShareLink: boolean };

export type RotateTripShareTokenMutationVariables = Exact<{
  tripId: Scalars['ID']['input'];
}>;


export type RotateTripShareTokenMutation = { __typename?: 'Mutation', rotateTripShareToken: string };

export type SaveTripMutationVariables = Exact<{
  tripId: Scalars['ID']['input'];
}>;


export type SaveTripMutation = { __typename?: 'Mutation', saveTrip: boolean };

export type SetTripParticipantRoleMutationVariables = Exact<{
  input: SetParticipantRoleInput;
}>;


export type SetTripParticipantRoleMutation = { __typename?: 'Mutation', setTripParticipantRole: boolean };

export type ShareRideAsTripMutationVariables = Exact<{
  input: ShareRideAsTripInput;
}>;


export type ShareRideAsTripMutation = { __typename?: 'Mutation', shareRideAsTrip: { __typename?: 'Trip', id: string, title: string, distanceM?: number | null } };

export type ShareRideMutationVariables = Exact<{
  rideId: Scalars['String']['input'];
  sharedWithUserId: Scalars['String']['input'];
}>;


export type ShareRideMutation = { __typename?: 'Mutation', shareRide: boolean };

export type StartRideMutationVariables = Exact<{
  input: StartRideInput;
}>;


export type StartRideMutation = { __typename?: 'Mutation', startRide: { __typename?: 'Ride', id: string, status: RideStatus, startedAt: string, motorcycleId?: string | null } };

export type SubmitDiagnosticMutationVariables = Exact<{
  input: SubmitDiagnosticInput;
}>;


export type SubmitDiagnosticMutation = { __typename?: 'Mutation', submitDiagnostic: { __typename?: 'Diagnostic', id: string, userId: string, motorcycleId?: string | null, severity?: DiagnosticSeverity | null, confidence?: number | null, relatedArticleId?: string | null, resultJson?: Record<string, unknown> | null, description?: string | null, photoUrl?: string | null, status: string, createdAt: string } };

export type TrackAffiliateClickMutationVariables = Exact<{
  input: TrackClickInput;
}>;


export type TrackAffiliateClickMutation = { __typename?: 'Mutation', trackAffiliateClick: { __typename?: 'AffiliateProduct', partner: AffiliatePartner, affiliateUrl: string, productUrl: string, tracked: boolean } };

export type UnfollowRiderMutationVariables = Exact<{
  input: UnfollowRiderInput;
}>;


export type UnfollowRiderMutation = { __typename?: 'Mutation', unfollowRider: boolean };

export type UnpublishTemplateMutationVariables = Exact<{
  tripId: Scalars['ID']['input'];
}>;


export type UnpublishTemplateMutation = { __typename?: 'Mutation', unpublishTemplate: boolean };

export type UnsaveTripMutationVariables = Exact<{
  tripId: Scalars['ID']['input'];
}>;


export type UnsaveTripMutation = { __typename?: 'Mutation', unsaveTrip: boolean };

export type UnshareRideMutationVariables = Exact<{
  rideId: Scalars['String']['input'];
  sharedWithUserId: Scalars['String']['input'];
}>;


export type UnshareRideMutation = { __typename?: 'Mutation', unshareRide: boolean };

export type UpdateDocumentCategoryMutationVariables = Exact<{
  id: Scalars['String']['input'];
  input: UpdateDocumentCategoryInput;
}>;


export type UpdateDocumentCategoryMutation = { __typename?: 'Mutation', updateDocumentCategory: { __typename?: 'DocumentCategory', id: string, name: string, kind: string, isHidden: boolean, promptsExpiry: boolean, updatedAt: string } };

export type UpdateDocumentMutationVariables = Exact<{
  id: Scalars['String']['input'];
  input: UpdateDocumentInput;
}>;


export type UpdateDocumentMutation = { __typename?: 'Mutation', updateDocument: { __typename?: 'Document', id: string, motorcycleId: string, categoryId: string, title: string, expiryDate?: string | null, note?: string | null, isPinned: boolean, updatedAt: string } };

export type UpdateMotorcycleMutationVariables = Exact<{
  id: Scalars['String']['input'];
  input: UpdateMotorcycleInput;
}>;


export type UpdateMotorcycleMutation = { __typename?: 'Mutation', updateMotorcycle: { __typename?: 'Motorcycle', id: string, make: string, model: string, year: number, nickname?: string | null, variant?: string | null, isPrimary: boolean, primaryPhotoUrl?: string | null, currentMileage?: number | null, mileageUnit?: string | null, mileageUpdatedAt?: string | null, purchasePrice?: number | null, purchaseDate?: string | null, vin?: string | null, recallCount?: number | null, recallLastCheckedAt?: string | null } };

export type UpdateMyProfileMutationVariables = Exact<{
  input: UpdateProfileInput;
}>;


export type UpdateMyProfileMutation = { __typename?: 'Mutation', updateMyProfile: { __typename?: 'User', id: string, fullName?: string | null, publicUsername?: string | null, displayName?: string | null, bio?: string | null, city?: string | null, isPublic?: boolean | null, followerCount?: number | null, followingCount?: number | null } };

export type UpdateParticipantStatusMutationVariables = Exact<{
  input: UpdateParticipantStatusInput;
}>;


export type UpdateParticipantStatusMutation = { __typename?: 'Mutation', updateParticipantStatus: boolean };

export type UpdateRideVisibilityMutationVariables = Exact<{
  rideId: Scalars['String']['input'];
  visibility: Scalars['String']['input'];
}>;


export type UpdateRideVisibilityMutation = { __typename?: 'Mutation', updateRideVisibility: { __typename?: 'Ride', id: string, visibility: string, isPublic: boolean } };

export type UpdateRideMutationVariables = Exact<{
  input: UpdateRideInput;
}>;


export type UpdateRideMutation = { __typename?: 'Mutation', updateRide: { __typename?: 'Ride', id: string, name?: string | null, mileageApplied: boolean, isPublic: boolean } };

export type UpdateTripMutationVariables = Exact<{
  input: UpdateTripInput;
}>;


export type UpdateTripMutation = { __typename?: 'Mutation', updateTrip: { __typename?: 'Trip', id: string, title: string, description: string, startDate: string, endDate: string, difficulty: string, maxRiders: number, status: string, visibility: string, waypoints?: Array<{ __typename?: 'TripWaypoint', id: string, tripId: string, sortOrder: number, dayIndex: number, periodOfDay?: PeriodOfDay | null, type: string, name: string, notes?: string | null, lat: number, lng: number }> | null } };

export type UpdateUserMutationVariables = Exact<{
  input: UpdateUserInput;
}>;


export type UpdateUserMutation = { __typename?: 'Mutation', updateUser: { __typename?: 'User', id: string, fullName?: string | null, preferences?: Record<string, unknown> | null, measurementSystem?: string | null, currency: string } };

export type UpdateWaypointMutationVariables = Exact<{
  input: UpdateWaypointInput;
}>;


export type UpdateWaypointMutation = { __typename?: 'Mutation', updateWaypoint: { __typename?: 'TripWaypoint', id: string, sortOrder: number, dayIndex: number, periodOfDay?: PeriodOfDay | null, type: string, name: string, notes?: string | null, lat: number, lng: number } };

export type UploadWaypointsMutationVariables = Exact<{
  input: UploadWaypointsInput;
}>;


export type UploadWaypointsMutation = { __typename?: 'Mutation', uploadWaypoints: number };

export type AllMaintenanceTasksQueryVariables = Exact<{ [key: string]: never; }>;


export type AllMaintenanceTasksQuery = { __typename?: 'Query', allMaintenanceTasks: Array<{ __typename?: 'MaintenanceTask', id: string, motorcycleId: string, title: string, dueDate?: string | null, targetMileage?: number | null, priority: MaintenancePriority, status: MaintenanceTaskStatus, completedAt?: string | null, remind30d: boolean, remind7d: boolean, remind1d: boolean }> };

export type ArticleBySlugFullQueryVariables = Exact<{
  slug: Scalars['String']['input'];
}>;


export type ArticleBySlugFullQuery = { __typename?: 'Query', articleBySlugFull?: { __typename?: 'Article', id: string, slug: string, title: string, difficulty: ArticleDifficulty, category: ArticleCategory, viewCount: number, isSafetyCritical: boolean, contentJson?: Record<string, unknown> | null, readTime?: number | null, generatedAt: string, updatedAt: string } | null };

export type DiagnosticByIdQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DiagnosticByIdQuery = { __typename?: 'Query', diagnosticById?: { __typename?: 'Diagnostic', id: string, userId: string, motorcycleId?: string | null, severity?: DiagnosticSeverity | null, confidence?: number | null, relatedArticleId?: string | null, resultJson?: Record<string, unknown> | null, description?: string | null, photoUrl?: string | null, status: string, dataSharingOptedIn: boolean, createdAt: string } | null };

export type DiscoverRiderTripsQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type DiscoverRiderTripsQuery = { __typename?: 'Query', discoverRiderTrips: { __typename?: 'TripConnection', edges: Array<{ __typename?: 'TripEdge', cursor: string, node: { __typename?: 'Trip', id: string, title: string, description: string, startDate: string, endDate: string, difficulty: string, maxRiders: number, participantCount: number, status: string, visibility: string, coverImageUrl?: string | null, createdAt: string, organiser: { __typename?: 'TripOrganiser', id: string, displayName: string, publicUsername?: string | null, avatarUrl?: string | null }, waypoints?: Array<{ __typename?: 'TripWaypoint', id: string, sortOrder: number, dayIndex: number, lat: number, lng: number }> | null } }>, pageInfo: { __typename?: 'TripPageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type DocumentCategoriesQueryVariables = Exact<{
  includeHidden?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type DocumentCategoriesQuery = { __typename?: 'Query', documentCategories: Array<{ __typename?: 'DocumentCategory', id: string, name: string, kind: string, isHidden: boolean, promptsExpiry: boolean, createdAt: string, updatedAt: string }> };

export type GetDocumentSignedUrlQueryVariables = Exact<{
  fileId: Scalars['String']['input'];
  download?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type GetDocumentSignedUrlQuery = { __typename?: 'Query', getDocumentSignedUrl: string };

export type DocumentsByMotorcycleQueryVariables = Exact<{
  motorcycleId: Scalars['String']['input'];
}>;


export type DocumentsByMotorcycleQuery = { __typename?: 'Query', documents: Array<{ __typename?: 'Document', id: string, motorcycleId: string, categoryId: string, title: string, expiryDate?: string | null, note?: string | null, isPinned: boolean, createdAt: string, updatedAt: string, files: Array<{ __typename?: 'DocumentFile', id: string, documentId: string, mimeType: string, fileSizeBytes?: number | null, createdAt: string }> }> };

export type ExpenseDashboardQueryVariables = Exact<{
  motorcycleId: Scalars['String']['input'];
}>;


export type ExpenseDashboardQuery = { __typename?: 'Query', expenseDashboard: { __typename?: 'ExpenseDashboardSummary', currentYearTotal: number, previousYearTotal: number, allTimeTotal: number, expenseCount: number, monthlyBuckets: Array<{ __typename?: 'MonthlyBucket', month: number, year: number, total: number, categories: Array<{ __typename?: 'CategoryTotal', category: string, total: number }> }>, categoryTotals: Array<{ __typename?: 'CategoryTotal', category: string, total: number }> } };

export type ExpensePhotosQueryVariables = Exact<{
  expenseId: Scalars['String']['input'];
}>;


export type ExpensePhotosQuery = { __typename?: 'Query', expensePhotos: Array<{ __typename?: 'ExpensePhoto', id: string, expenseId: string, storagePath: string, publicUrl: string, fileSizeBytes?: number | null, mimeType: string, createdAt: string }> };

export type ExpensesByMotorcycleQueryVariables = Exact<{
  motorcycleId: Scalars['String']['input'];
  year: Scalars['Int']['input'];
}>;


export type ExpensesByMotorcycleQuery = { __typename?: 'Query', expenses: { __typename?: 'ExpenseSummary', ytdTotal: number, categories: Array<{ __typename?: 'ExpenseCategory', category: string, total: number, expenses: Array<{ __typename?: 'Expense', id: string, amount: number, category: string, currency: string, description?: string | null, date: string, createdAt: string }> }> } };

export type ExpiringDocumentsQueryVariables = Exact<{
  withinDays?: InputMaybe<Scalars['Int']['input']>;
}>;


export type ExpiringDocumentsQuery = { __typename?: 'Query', expiringDocuments: Array<{ __typename?: 'Document', id: string, motorcycleId: string, categoryId: string, title: string, expiryDate?: string | null, isPinned: boolean }> };

export type FuelLogsQueryVariables = Exact<{
  motorcycleId: Scalars['String']['input'];
}>;


export type FuelLogsQuery = { __typename?: 'Query', fuelLogs: Array<{ __typename?: 'FuelLog', id: string, motorcycleId: string, odometerKm: number, fuelLitres: number, totalCost?: number | null, currency: string, fuelType: string, isPartial: boolean, notes?: string | null, filledAt: string, kmSincePrevious?: number | null, litresPer100Km?: number | null, mpgUs?: number | null }> };

export type GetArticleBySlugQueryVariables = Exact<{
  slug: Scalars['String']['input'];
}>;


export type GetArticleBySlugQuery = { __typename?: 'Query', articleBySlug?: { __typename?: 'Article', id: string, slug: string, title: string, difficulty: ArticleDifficulty, category: ArticleCategory, viewCount: number, isSafetyCritical: boolean, generatedAt: string, updatedAt: string } | null };

export type GetCommentsQueryVariables = Exact<{
  rideId?: InputMaybe<Scalars['ID']['input']>;
  routeId?: InputMaybe<Scalars['ID']['input']>;
  groupRideId?: InputMaybe<Scalars['ID']['input']>;
  tripId?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetCommentsQuery = { __typename?: 'Query', getComments: { __typename?: 'CommentConnection', hasNextPage: boolean, endCursor?: string | null, totalCount: number, comments: Array<{ __typename?: 'Comment', id: string, text: string, createdAt: string, flaggedCount: number, parentCommentId?: string | null, author: { __typename?: 'CommentAuthor', id: string, displayName: string, publicUsername?: string | null, avatarUrl?: string | null }, replies?: Array<{ __typename?: 'Comment', id: string, text: string, createdAt: string, flaggedCount: number, parentCommentId?: string | null, author: { __typename?: 'CommentAuthor', id: string, displayName: string, publicUsername?: string | null, avatarUrl?: string | null } }> | null }> } };

export type GetFollowersQueryVariables = Exact<{
  userId: Scalars['String']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetFollowersQuery = { __typename?: 'Query', getFollowers: { __typename?: 'FollowConnection', totalCount: number, edges: Array<{ __typename?: 'FollowEdge', cursor: string, node: { __typename?: 'Follow', followerId: string, followingId: string, createdAt: string, displayName?: string | null, publicUsername?: string | null, avatarUrl?: string | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type GetFollowingQueryVariables = Exact<{
  userId: Scalars['String']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetFollowingQuery = { __typename?: 'Query', getFollowing: { __typename?: 'FollowConnection', totalCount: number, edges: Array<{ __typename?: 'FollowEdge', cursor: string, node: { __typename?: 'Follow', followerId: string, followingId: string, createdAt: string, displayName?: string | null, publicUsername?: string | null, avatarUrl?: string | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type GetGroupRidesQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetGroupRidesQuery = { __typename?: 'Query', getGroupRides: { __typename?: 'GroupRideConnection', edges: Array<{ __typename?: 'GroupRideEdge', cursor: string, node: { __typename?: 'GroupRide', id: string, title: string, description: string, dateTime: string, meetingPointLat: number, meetingPointLng: number, meetingPointName?: string | null, routeId?: string | null, difficulty: string, maxRiders: number, participantCount: number, status: string, createdAt: string, organiser: { __typename?: 'GroupRideOrganiser', id: string, displayName: string, publicUsername?: string | null, avatarUrl?: string | null } } }>, pageInfo: { __typename?: 'GroupRidePageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type GetOnboardingRevealQueryVariables = Exact<{
  make: Scalars['String']['input'];
  year: Scalars['Int']['input'];
  model?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetOnboardingRevealQuery = { __typename?: 'Query', onboardingReveal: { __typename?: 'OnboardingReveal', year: number, make: string, model?: string | null, recallCount: number, recallsChecked: boolean, oemTaskCount: number, projectedYearlyCostEur?: number | null, riderCount: number, recalls: Array<{ __typename?: 'RevealRecall', component: string, summary: string }>, insights: { __typename?: 'RevealInsights', status: string, knownIssues: Array<{ __typename?: 'RevealKnownIssue', title: string, detail: string }> } } };

export type GetPublicRideQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetPublicRideQuery = { __typename?: 'Query', getPublicRide: { __typename?: 'Ride', id: string, userId: string, status: RideStatus, name?: string | null, startedAt: string, endedAt?: string | null, distanceM?: number | null, maxSpeedMps?: number | null, avgSpeedMps?: number | null, elevationGain?: number | null, elevationLoss?: number | null, pausedDurationS: number, autoPausedDurationS: number, durationS?: number | null, motorcycleId?: string | null, routePolyline?: string | null, routeThumbnailUri?: string | null, gpsQuality?: number | null, mileageApplied: boolean, isPublic: boolean, createdAt: string } };

export type GetRideWaypointsQueryVariables = Exact<{
  rideId: Scalars['String']['input'];
  maxPoints?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetRideWaypointsQuery = { __typename?: 'Query', rideWaypoints: Array<{ __typename?: 'Waypoint', recordedAt: string, latitude: number, longitude: number, altitude?: number | null, speedMps?: number | null }> };

export type GetRideQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetRideQuery = { __typename?: 'Query', ride: { __typename?: 'Ride', id: string, status: RideStatus, name?: string | null, startedAt: string, endedAt?: string | null, distanceM?: number | null, maxSpeedMps?: number | null, avgSpeedMps?: number | null, maxLeanAngle?: number | null, elevationGain?: number | null, elevationLoss?: number | null, pausedDurationS: number, autoPausedDurationS: number, durationS?: number | null, motorcycleId?: string | null, routePolyline?: string | null, routeThumbnailUri?: string | null, gpsQuality?: number | null, mileageApplied: boolean, isPublic: boolean, createdAt: string } };

export type GetRiderProfileQueryVariables = Exact<{
  username: Scalars['String']['input'];
}>;


export type GetRiderProfileQuery = { __typename?: 'Query', getRiderProfile: { __typename?: 'PublicRiderProfile', id: string, publicUsername: string, displayName?: string | null, bio?: string | null, city?: string | null, avatarUrl?: string | null, followerCount: number, followingCount: number, isFollowing?: boolean | null, bikes: Array<{ __typename?: 'PublicRiderBike', make: string, model: string, year: number, nickname?: string | null }>, rideStats: { __typename?: 'PublicRideStats', totalRides: number, totalDistance: number, joinDate?: string | null } } };

export type GetTripsQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetTripsQuery = { __typename?: 'Query', getTrips: { __typename?: 'TripConnection', edges: Array<{ __typename?: 'TripEdge', cursor: string, node: { __typename?: 'Trip', id: string, title: string, description: string, startDate: string, endDate: string, difficulty: string, maxRiders: number, participantCount: number, status: string, visibility: string, coverImageUrl?: string | null, createdAt: string, organiser: { __typename?: 'TripOrganiser', id: string, displayName: string, publicUsername?: string | null, avatarUrl?: string | null }, waypoints?: Array<{ __typename?: 'TripWaypoint', id: string, sortOrder: number, dayIndex: number, lat: number, lng: number }> | null } }>, pageInfo: { __typename?: 'TripPageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type GroupRideDetailQueryVariables = Exact<{
  groupRideId: Scalars['ID']['input'];
}>;


export type GroupRideDetailQuery = { __typename?: 'Query', groupRideDetail: { __typename?: 'GroupRide', id: string, title: string, description: string, dateTime: string, meetingPointLat: number, meetingPointLng: number, meetingPointName?: string | null, routeId?: string | null, routeDescription?: string | null, difficulty: string, maxRiders: number, participantCount: number, status: string, createdAt: string, organiser: { __typename?: 'GroupRideOrganiser', id: string, displayName: string, publicUsername?: string | null, avatarUrl?: string | null }, participants?: Array<{ __typename?: 'GroupRideParticipant', id: string, displayName: string, publicUsername?: string | null, avatarUrl?: string | null, joinedAt: string }> | null } };

export type IsTripSavedQueryVariables = Exact<{
  tripId: Scalars['ID']['input'];
}>;


export type IsTripSavedQuery = { __typename?: 'Query', isTripSaved: boolean };

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


export type MaintenanceTasksByMotorcycleQuery = { __typename?: 'Query', maintenanceTasks: Array<{ __typename?: 'MaintenanceTask', id: string, userId: string, motorcycleId: string, title: string, description?: string | null, dueDate?: string | null, targetMileage?: number | null, priority: MaintenancePriority, status: MaintenanceTaskStatus, notes?: string | null, partsNeeded?: Array<string> | null, completedAt?: string | null, completedMileage?: number | null, cost?: number | null, partsCost?: number | null, laborCost?: number | null, currency?: string | null, source: MaintenanceTaskSource, isRecurring: boolean, intervalKm?: number | null, intervalDays?: number | null, remind30d: boolean, remind7d: boolean, remind1d: boolean, createdAt: string, updatedAt: string, photos: Array<{ __typename?: 'TaskPhoto', id: string, storagePath: string, publicUrl: string }> }> };

export type MakeStatsQueryVariables = Exact<{ [key: string]: never; }>;


export type MakeStatsQuery = { __typename?: 'Query', makeStats: Array<{ __typename?: 'MakeStats', make: string, riders: number, models: number, totalBikes: number, rank: number }> };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { __typename?: 'Query', me: { __typename?: 'User', id: string, email: string, fullName?: string | null, role: UserRole, preferences?: Record<string, unknown> | null, measurementSystem?: string | null, currency: string, publicUsername?: string | null, displayName?: string | null, bio?: string | null, city?: string | null, isPublic?: boolean | null, followerCount?: number | null, followingCount?: number | null, avatarUrl?: string | null, createdAt: string, updatedAt: string } };

export type MotorcycleMakesQueryVariables = Exact<{ [key: string]: never; }>;


export type MotorcycleMakesQuery = { __typename?: 'Query', motorcycleMakes: Array<{ __typename?: 'MotorcycleMake', makeId: number, makeName: string, isPopular: boolean }> };

export type MotorcycleModelsQueryVariables = Exact<{
  makeId: Scalars['Int']['input'];
  year: Scalars['Int']['input'];
}>;


export type MotorcycleModelsQuery = { __typename?: 'Query', motorcycleModels: Array<{ __typename?: 'MotorcycleModelResult', modelId: number, modelName: string }> };

export type MotorcycleRecallsQueryVariables = Exact<{
  motorcycleId: Scalars['String']['input'];
}>;


export type MotorcycleRecallsQuery = { __typename?: 'Query', motorcycleRecalls: { __typename?: 'RecallResult', count: number, checkedAt: string, vinUsed?: string | null, recalls: Array<{ __typename?: 'Recall', campaignNumber: string, reportDate: string, component: string, summary: string, consequence: string, remedy: string }> } };

export type MyDiagnosticsQueryVariables = Exact<{ [key: string]: never; }>;


export type MyDiagnosticsQuery = { __typename?: 'Query', myDiagnostics: Array<{ __typename?: 'Diagnostic', id: string, userId: string, motorcycleId?: string | null, severity?: DiagnosticSeverity | null, confidence?: number | null, relatedArticleId?: string | null, status: string, dataSharingOptedIn: boolean, createdAt: string }> };

export type GetMyHealthReportsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMyHealthReportsQuery = { __typename?: 'Query', getMyHealthReports: Array<{ __typename?: 'HealthReport', id: string, userId: string, motorcycleId?: string | null, status: HealthReportStatus, pdfUrl?: string | null, iapTransactionId?: string | null, createdAt: string, completedAt?: string | null }> };

export type MyMotorcyclesQueryVariables = Exact<{ [key: string]: never; }>;


export type MyMotorcyclesQuery = { __typename?: 'Query', myMotorcycles: Array<{ __typename?: 'Motorcycle', id: string, userId: string, make: string, model: string, year: number, nickname?: string | null, variant?: string | null, isPrimary: boolean, primaryPhotoUrl?: string | null, currentMileage?: number | null, mileageUnit?: string | null, mileageUpdatedAt?: string | null, purchasePrice?: number | null, purchaseDate?: string | null, type?: MotorcycleType | null, engineCc?: number | null, vin?: string | null, recallCount?: number | null, recallLastCheckedAt?: string | null, odometerSyncSource?: string | null, odometerLastRideId?: string | null, createdAt: string }> };

export type MyProgressQueryVariables = Exact<{ [key: string]: never; }>;


export type MyProgressQuery = { __typename?: 'Query', myProgress: Array<{ __typename?: 'LearningProgress', id: string, userId: string, articleId: string, articleRead: boolean, quizCompleted: boolean, quizBestScore?: number | null, firstReadAt?: string | null, lastReadAt?: string | null }> };

export type MyRidesForHeatmapQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type MyRidesForHeatmapQuery = { __typename?: 'Query', myRides: { __typename?: 'RideConnection', totalCount: number, edges: Array<{ __typename?: 'RideEdge', cursor: string, node: { __typename?: 'Ride', id: string, name?: string | null, startedAt: string, distanceM?: number | null, region?: string | null, routePolyline?: string | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type MyRidesQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  motorcycleId?: InputMaybe<Scalars['String']['input']>;
}>;


export type MyRidesQuery = { __typename?: 'Query', myRides: { __typename?: 'RideConnection', totalCount: number, edges: Array<{ __typename?: 'RideEdge', cursor: string, node: { __typename?: 'Ride', id: string, status: RideStatus, name?: string | null, startedAt: string, endedAt?: string | null, distanceM?: number | null, maxSpeedMps?: number | null, avgSpeedMps?: number | null, elevationGain?: number | null, pausedDurationS: number, autoPausedDurationS: number, durationS?: number | null, motorcycleId?: string | null, routePolyline?: string | null, routeThumbnailUri?: string | null, gpsQuality?: number | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type MyShareLinksQueryVariables = Exact<{
  motorcycleId: Scalars['ID']['input'];
}>;


export type MyShareLinksQuery = { __typename?: 'Query', myShareLinks: Array<{ __typename?: 'ShareLink', id: string, motorcycleId: string, expiresAt: string, createdAt: string }> };

export type MyTripsQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type MyTripsQuery = { __typename?: 'Query', myTrips: { __typename?: 'TripConnection', edges: Array<{ __typename?: 'TripEdge', cursor: string, node: { __typename?: 'Trip', id: string, title: string, description: string, startDate: string, endDate: string, difficulty: string, maxRiders: number, participantCount: number, status: string, visibility: string, coverImageUrl?: string | null, createdAt: string, waypoints?: Array<{ __typename?: 'TripWaypoint', id: string }> | null, organiser: { __typename?: 'TripOrganiser', id: string, displayName: string, publicUsername?: string | null, avatarUrl?: string | null } } }>, pageInfo: { __typename?: 'TripPageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type OemSchedulesPreviewQueryVariables = Exact<{
  make: Scalars['String']['input'];
  model?: InputMaybe<Scalars['String']['input']>;
  year?: InputMaybe<Scalars['Int']['input']>;
  variant?: InputMaybe<Scalars['String']['input']>;
}>;


export type OemSchedulesPreviewQuery = { __typename?: 'Query', oemSchedulesPreview: Array<{ __typename?: 'OemSchedule', id: string, taskName: string, description?: string | null, intervalKm?: number | null, intervalDays?: number | null, priority: MaintenancePriority, sortOrder: number }> };

export type RideOverviewQueryVariables = Exact<{ [key: string]: never; }>;


export type RideOverviewQuery = { __typename?: 'Query', rideOverview: { __typename?: 'RideOverview', currentStreak: number, lastRide?: { __typename?: 'LastRideSummary', id: string, distanceM: number, durationS: number, maxSpeedMps?: number | null, date: string, motorcycleName?: string | null, summaryTitle?: string | null } | null, last7Days: { __typename?: 'RidePeriodSummary', rideCount: number, distanceM: number, durationS: number }, last30Days: { __typename?: 'RidePeriodSummary', rideCount: number, distanceM: number, durationS: number }, thisWeek: { __typename?: 'RidePeriodSummary', rideCount: number, distanceM: number, durationS: number }, thisMonth: { __typename?: 'RidePeriodSummary', rideCount: number, distanceM: number, durationS: number }, dailyDistances: Array<{ __typename?: 'DailyDistance', date: string, distanceM: number }>, personalRecords: Array<{ __typename?: 'RideRecord', recordType: string, value: number, unit: string, achievedAt: string, previousValue?: number | null, rideId?: string | null }> } };

export type SavedTripsQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type SavedTripsQuery = { __typename?: 'Query', savedTrips: { __typename?: 'TripConnection', edges: Array<{ __typename?: 'TripEdge', cursor: string, node: { __typename?: 'Trip', id: string, slug?: string | null, title: string, description: string, difficulty: string, dayCount?: number | null, startLat?: number | null, startLng?: number | null, countryCode?: string | null, regionCode?: string | null, city?: string | null, distanceM?: number | null, elevationGainM?: number | null, surfaceType?: string | null, isFeatured: boolean, isMotovaultPick: boolean, viewCount: number, cloneCount: number, averageRating?: number | null, reviewCount: number, publishedAt?: string | null, isTemplate: boolean, isSaved?: boolean | null, organiser: { __typename?: 'TripOrganiser', id: string, displayName: string, publicUsername?: string | null, avatarUrl?: string | null } } }>, pageInfo: { __typename?: 'TripPageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type SearchArticlesQueryVariables = Exact<{
  input: SearchArticlesInput;
}>;


export type SearchArticlesQuery = { __typename?: 'Query', searchArticles: { __typename?: 'ArticleConnection', totalCount: number, edges: Array<{ __typename?: 'ArticleEdge', cursor: string, node: { __typename?: 'Article', id: string, slug: string, title: string, difficulty: ArticleDifficulty, category: ArticleCategory, viewCount: number, isSafetyCritical: boolean, generatedAt: string, updatedAt: string, keywords?: Array<string> | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type SearchTypeaheadQueryVariables = Exact<{
  q?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SearchTypeaheadQuery = { __typename?: 'Query', searchTypeahead: { __typename?: 'TypeaheadResult', routes: Array<{ __typename?: 'RouteSuggestion', id: string, name: string, slug: string, countryCode: string, regionCode?: string | null }>, places: Array<{ __typename?: 'PlaceSuggestion', id: number, name: string, kind: string, countryCode: string, regionCode?: string | null, population: number }> } };

export type SpendingSummaryQueryVariables = Exact<{
  motorcycleId: Scalars['String']['input'];
}>;


export type SpendingSummaryQuery = { __typename?: 'Query', spendingSummary: { __typename?: 'SpendingSummary', thisYear: number, allTime: number } };

export type TemplateTripIdForRouteQueryVariables = Exact<{
  routeId: Scalars['ID']['input'];
}>;


export type TemplateTripIdForRouteQuery = { __typename?: 'Query', templateTripIdForRoute?: string | null };

export type TripByShareTokenQueryVariables = Exact<{
  shareToken: Scalars['String']['input'];
}>;


export type TripByShareTokenQuery = { __typename?: 'Query', tripByShareToken?: { __typename?: 'SharedTrip', id: string, title: string, description?: string | null, status: string, difficulty: string, startDate: string, endDate: string, maxRiders: number, participantCount: number, coverImageUrl?: string | null, waypoints: Array<{ __typename?: 'SharedTripWaypoint', id: string, sortOrder: number, dayIndex?: number | null, periodOfDay?: PeriodOfDay | null, type: string, name: string, notes?: string | null, lat: number, lng: number }>, participants: Array<{ __typename?: 'SharedTripParticipant', anonId: string, role: string, status: string, displayName: string, avatarUrl?: string | null }> } | null };

export type TripBySlugQueryVariables = Exact<{
  country: Scalars['String']['input'];
  region: Scalars['String']['input'];
  slug: Scalars['String']['input'];
}>;


export type TripBySlugQuery = { __typename?: 'Query', tripBySlug?: { __typename?: 'Trip', id: string, slug?: string | null, title: string, description: string, difficulty: string, dayCount?: number | null, startDate: string, endDate: string, maxRiders: number, participantCount: number, status: string, visibility: string, coverImageUrl?: string | null, isTemplate: boolean, polyline?: string | null, startLat?: number | null, startLng?: number | null, countryCode?: string | null, regionCode?: string | null, city?: string | null, distanceM?: number | null, elevationGainM?: number | null, estimatedDurationMinutes?: number | null, surfaceType?: string | null, curvatureIndex?: number | null, isFeatured: boolean, isMotovaultPick: boolean, viewCount: number, cloneCount: number, averageRating?: number | null, reviewCount: number, publishedAt?: string | null, isFlagged: boolean, clonedFromTripId?: string | null, forkedFromTripId?: string | null, createdAt: string, organiser: { __typename?: 'TripOrganiser', id: string, displayName: string, publicUsername?: string | null, avatarUrl?: string | null }, waypoints?: Array<{ __typename?: 'TripWaypoint', id: string, tripId: string, sortOrder: number, dayIndex: number, periodOfDay?: PeriodOfDay | null, type: string, name: string, notes?: string | null, lat: number, lng: number, createdAt: string }> | null } | null };

export type TripDetailQueryVariables = Exact<{
  tripId: Scalars['ID']['input'];
}>;


export type TripDetailQuery = { __typename?: 'Query', tripDetail: { __typename?: 'Trip', id: string, title: string, description: string, startDate: string, endDate: string, datesPending?: boolean | null, difficulty: string, maxRiders: number, participantCount: number, status: string, visibility: string, coverImageUrl?: string | null, createdAt: string, isTemplate: boolean, slug?: string | null, polyline?: string | null, startLat?: number | null, startLng?: number | null, countryCode?: string | null, regionCode?: string | null, city?: string | null, distanceM?: number | null, elevationGainM?: number | null, estimatedDurationMinutes?: number | null, surfaceType?: string | null, curvatureIndex?: number | null, dayCount?: number | null, isFeatured: boolean, isMotovaultPick: boolean, viewCount: number, cloneCount: number, averageRating?: number | null, reviewCount: number, publishedAt?: string | null, isFlagged: boolean, isSaved?: boolean | null, clonedFromTripId?: string | null, forkedFromTripId?: string | null, organiser: { __typename?: 'TripOrganiser', id: string, displayName: string, publicUsername?: string | null, avatarUrl?: string | null }, waypoints?: Array<{ __typename?: 'TripWaypoint', id: string, tripId: string, sortOrder: number, dayIndex: number, periodOfDay?: PeriodOfDay | null, type: string, name: string, notes?: string | null, lat: number, lng: number, createdAt: string }> | null, participants?: Array<{ __typename?: 'TripParticipant', id: string, displayName: string, publicUsername?: string | null, avatarUrl?: string | null, role: string, status: string, bikeId?: string | null, joinedAt: string }> | null } };

export type TripInvitesQueryVariables = Exact<{
  tripId: Scalars['ID']['input'];
}>;


export type TripInvitesQuery = { __typename?: 'Query', tripInvites: Array<{ __typename?: 'TripInvite', id: string, invitedUserId: string, invitedAt: string, acceptedAt?: string | null, declinedAt?: string | null }> };

export type TripReviewsQueryVariables = Exact<{
  tripId: Scalars['ID']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type TripReviewsQuery = { __typename?: 'Query', tripReviews: Array<{ __typename?: 'TripReview', id: string, rating: number, text?: string | null, conditionTags?: Array<string> | null, createdAt: string, tripId: string, userId?: string | null, bikeId?: string | null, author?: { __typename?: 'TripReviewAuthor', id: string, displayName: string, publicUsername?: string | null, avatarUrl?: string | null } | null, bike?: { __typename?: 'TripReviewBike', make: string, model: string, year: number, type?: string | null } | null }> };

export type TripSuggestionsQueryVariables = Exact<{
  tripId: Scalars['ID']['input'];
}>;


export type TripSuggestionsQuery = { __typename?: 'Query', tripSuggestions: Array<{ __typename?: 'TripSuggestion', id: string, tripId: string, kind: TripSuggestionKind, name: string, notes?: string | null, lat?: number | null, lng?: number | null, dayIndex?: number | null, periodOfDay?: PeriodOfDay | null, status: TripSuggestionStatus, decidedBy?: string | null, decidedAt?: string | null, decidedNote?: string | null, waypointId?: string | null, createdAt: string, author: { __typename?: 'TripSuggestionAuthor', id: string, displayName: string, avatarUrl?: string | null, publicUsername?: string | null } }> };

export type TripTemplatesQueryVariables = Exact<{
  filter?: InputMaybe<TripTemplateFilterInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type TripTemplatesQuery = { __typename?: 'Query', tripTemplates: { __typename?: 'TripConnection', edges: Array<{ __typename?: 'TripEdge', cursor: string, node: { __typename?: 'Trip', id: string, slug?: string | null, title: string, description: string, difficulty: string, dayCount?: number | null, startLat?: number | null, startLng?: number | null, countryCode?: string | null, regionCode?: string | null, city?: string | null, distanceM?: number | null, elevationGainM?: number | null, surfaceType?: string | null, polyline?: string | null, curvatureIndex?: number | null, estimatedDurationMinutes?: number | null, isFeatured: boolean, isMotovaultPick: boolean, coverImageUrl?: string | null, viewCount: number, cloneCount: number, averageRating?: number | null, reviewCount: number, publishedAt?: string | null, organiser: { __typename?: 'TripOrganiser', id: string, displayName: string, publicUsername?: string | null, avatarUrl?: string | null } } }>, pageInfo: { __typename?: 'TripPageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type BlogPostFieldsFragment = { __typename?: 'BlogPost', id: string, type: string, slug: string, status: string, publishedAt?: string | null, scheduledFor?: string | null, author?: string | null, coverImage?: string | null, coverAlt?: string | null, specData: boolean, isSafetyCritical: boolean, createdAt: string, updatedAt: string, typeData?: Record<string, unknown> | null, translations: Array<{ __typename?: 'BlogTranslation', locale: string, title: string, excerpt?: string | null, seoTitle?: string | null, seoDescription?: string | null, bodyRaw: string, faq?: Record<string, unknown> | null, readingTime?: string | null, wordCount?: number | null }>, categories: Array<{ __typename?: 'BlogCategory', id: string, slug: string, name: string, parentId?: string | null, isPrimary?: boolean | null }>, keywords: Array<{ __typename?: 'BlogKeyword', id: string, slug: string, name: string }> };

export type ApproveMaintenanceDraftMutationVariables = Exact<{
  input: ApproveMaintenanceDraftInput;
}>;


export type ApproveMaintenanceDraftMutation = { __typename?: 'Mutation', approveMaintenanceDraft: boolean };

export type CreateBlogCategoryMutationVariables = Exact<{
  input: CreateBlogCategoryInput;
}>;


export type CreateBlogCategoryMutation = { __typename?: 'Mutation', createBlogCategory: { __typename?: 'BlogCategory', id: string, slug: string, name: string, parentId?: string | null } };

export type CreateBlogKeywordMutationVariables = Exact<{
  input: CreateBlogKeywordInput;
}>;


export type CreateBlogKeywordMutation = { __typename?: 'Mutation', createBlogKeyword: { __typename?: 'BlogKeyword', id: string, slug: string, name: string } };

export type CreateBlogPostMutationVariables = Exact<{
  input: CreateBlogPostInput;
}>;


export type CreateBlogPostMutation = { __typename?: 'Mutation', createBlogPost: { __typename?: 'BlogPost', id: string, type: string, slug: string, status: string, publishedAt?: string | null, scheduledFor?: string | null, author?: string | null, coverImage?: string | null, coverAlt?: string | null, specData: boolean, isSafetyCritical: boolean, createdAt: string, updatedAt: string, typeData?: Record<string, unknown> | null, translations: Array<{ __typename?: 'BlogTranslation', locale: string, title: string, excerpt?: string | null, seoTitle?: string | null, seoDescription?: string | null, bodyRaw: string, faq?: Record<string, unknown> | null, readingTime?: string | null, wordCount?: number | null }>, categories: Array<{ __typename?: 'BlogCategory', id: string, slug: string, name: string, parentId?: string | null, isPrimary?: boolean | null }>, keywords: Array<{ __typename?: 'BlogKeyword', id: string, slug: string, name: string }> } };

export type DeleteBlogPostMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteBlogPostMutation = { __typename?: 'Mutation', deleteBlogPost: boolean };

export type JoinWaitlistMutationVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type JoinWaitlistMutation = { __typename?: 'Mutation', joinWaitlist: boolean };

export type PublishBlogPostMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type PublishBlogPostMutation = { __typename?: 'Mutation', publishBlogPost: { __typename?: 'BlogPost', id: string, type: string, slug: string, status: string, publishedAt?: string | null, scheduledFor?: string | null, author?: string | null, coverImage?: string | null, coverAlt?: string | null, specData: boolean, isSafetyCritical: boolean, createdAt: string, updatedAt: string, typeData?: Record<string, unknown> | null, translations: Array<{ __typename?: 'BlogTranslation', locale: string, title: string, excerpt?: string | null, seoTitle?: string | null, seoDescription?: string | null, bodyRaw: string, faq?: Record<string, unknown> | null, readingTime?: string | null, wordCount?: number | null }>, categories: Array<{ __typename?: 'BlogCategory', id: string, slug: string, name: string, parentId?: string | null, isPrimary?: boolean | null }>, keywords: Array<{ __typename?: 'BlogKeyword', id: string, slug: string, name: string }> } };

export type RevertBlogPostVersionMutationVariables = Exact<{
  id: Scalars['String']['input'];
  versionNum: Scalars['Int']['input'];
}>;


export type RevertBlogPostVersionMutation = { __typename?: 'Mutation', revertBlogPostVersion: { __typename?: 'BlogPost', id: string, type: string, slug: string, status: string, publishedAt?: string | null, scheduledFor?: string | null, author?: string | null, coverImage?: string | null, coverAlt?: string | null, specData: boolean, isSafetyCritical: boolean, createdAt: string, updatedAt: string, typeData?: Record<string, unknown> | null, translations: Array<{ __typename?: 'BlogTranslation', locale: string, title: string, excerpt?: string | null, seoTitle?: string | null, seoDescription?: string | null, bodyRaw: string, faq?: Record<string, unknown> | null, readingTime?: string | null, wordCount?: number | null }>, categories: Array<{ __typename?: 'BlogCategory', id: string, slug: string, name: string, parentId?: string | null, isPrimary?: boolean | null }>, keywords: Array<{ __typename?: 'BlogKeyword', id: string, slug: string, name: string }> } };

export type ScheduleBlogPostMutationVariables = Exact<{
  input: ScheduleBlogPostInput;
}>;


export type ScheduleBlogPostMutation = { __typename?: 'Mutation', scheduleBlogPost: { __typename?: 'BlogPost', id: string, type: string, slug: string, status: string, publishedAt?: string | null, scheduledFor?: string | null, author?: string | null, coverImage?: string | null, coverAlt?: string | null, specData: boolean, isSafetyCritical: boolean, createdAt: string, updatedAt: string, typeData?: Record<string, unknown> | null, translations: Array<{ __typename?: 'BlogTranslation', locale: string, title: string, excerpt?: string | null, seoTitle?: string | null, seoDescription?: string | null, bodyRaw: string, faq?: Record<string, unknown> | null, readingTime?: string | null, wordCount?: number | null }>, categories: Array<{ __typename?: 'BlogCategory', id: string, slug: string, name: string, parentId?: string | null, isPrimary?: boolean | null }>, keywords: Array<{ __typename?: 'BlogKeyword', id: string, slug: string, name: string }> } };

export type UnpublishBlogPostMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type UnpublishBlogPostMutation = { __typename?: 'Mutation', unpublishBlogPost: { __typename?: 'BlogPost', id: string, type: string, slug: string, status: string, publishedAt?: string | null, scheduledFor?: string | null, author?: string | null, coverImage?: string | null, coverAlt?: string | null, specData: boolean, isSafetyCritical: boolean, createdAt: string, updatedAt: string, typeData?: Record<string, unknown> | null, translations: Array<{ __typename?: 'BlogTranslation', locale: string, title: string, excerpt?: string | null, seoTitle?: string | null, seoDescription?: string | null, bodyRaw: string, faq?: Record<string, unknown> | null, readingTime?: string | null, wordCount?: number | null }>, categories: Array<{ __typename?: 'BlogCategory', id: string, slug: string, name: string, parentId?: string | null, isPrimary?: boolean | null }>, keywords: Array<{ __typename?: 'BlogKeyword', id: string, slug: string, name: string }> } };

export type UpdateBlogPostMutationVariables = Exact<{
  input: UpdateBlogPostInput;
}>;


export type UpdateBlogPostMutation = { __typename?: 'Mutation', updateBlogPost: { __typename?: 'BlogPost', id: string, type: string, slug: string, status: string, publishedAt?: string | null, scheduledFor?: string | null, author?: string | null, coverImage?: string | null, coverAlt?: string | null, specData: boolean, isSafetyCritical: boolean, createdAt: string, updatedAt: string, typeData?: Record<string, unknown> | null, translations: Array<{ __typename?: 'BlogTranslation', locale: string, title: string, excerpt?: string | null, seoTitle?: string | null, seoDescription?: string | null, bodyRaw: string, faq?: Record<string, unknown> | null, readingTime?: string | null, wordCount?: number | null }>, categories: Array<{ __typename?: 'BlogCategory', id: string, slug: string, name: string, parentId?: string | null, isPrimary?: boolean | null }>, keywords: Array<{ __typename?: 'BlogKeyword', id: string, slug: string, name: string }> } };

export type AdminBlogPostVersionsQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type AdminBlogPostVersionsQuery = { __typename?: 'Query', adminBlogPostVersions: Array<{ __typename?: 'BlogPostVersion', versionNum: number, title?: string | null, status?: string | null, createdBy?: string | null, createdAt: string }> };

export type AdminBlogPostQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type AdminBlogPostQuery = { __typename?: 'Query', adminBlogPost?: { __typename?: 'BlogPost', id: string, type: string, slug: string, status: string, publishedAt?: string | null, scheduledFor?: string | null, author?: string | null, coverImage?: string | null, coverAlt?: string | null, specData: boolean, isSafetyCritical: boolean, createdAt: string, updatedAt: string, typeData?: Record<string, unknown> | null, translations: Array<{ __typename?: 'BlogTranslation', locale: string, title: string, excerpt?: string | null, seoTitle?: string | null, seoDescription?: string | null, bodyRaw: string, faq?: Record<string, unknown> | null, readingTime?: string | null, wordCount?: number | null }>, categories: Array<{ __typename?: 'BlogCategory', id: string, slug: string, name: string, parentId?: string | null, isPrimary?: boolean | null }>, keywords: Array<{ __typename?: 'BlogKeyword', id: string, slug: string, name: string }> } | null };

export type AdminBlogPostsQueryVariables = Exact<{
  input?: InputMaybe<ListBlogPostsInput>;
}>;


export type AdminBlogPostsQuery = { __typename?: 'Query', adminBlogPosts: { __typename?: 'BlogPostConnection', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, edges: Array<{ __typename?: 'BlogPostEdge', cursor: string, node: { __typename?: 'BlogPost', id: string, type: string, slug: string, status: string, publishedAt?: string | null, scheduledFor?: string | null, author?: string | null, coverImage?: string | null, coverAlt?: string | null, specData: boolean, isSafetyCritical: boolean, createdAt: string, updatedAt: string, typeData?: Record<string, unknown> | null, translations: Array<{ __typename?: 'BlogTranslation', locale: string, title: string, excerpt?: string | null, seoTitle?: string | null, seoDescription?: string | null, bodyRaw: string, faq?: Record<string, unknown> | null, readingTime?: string | null, wordCount?: number | null }>, categories: Array<{ __typename?: 'BlogCategory', id: string, slug: string, name: string, parentId?: string | null, isPrimary?: boolean | null }>, keywords: Array<{ __typename?: 'BlogKeyword', id: string, slug: string, name: string }> } }> } };

export type BlogTaxonomyQueryVariables = Exact<{ [key: string]: never; }>;


export type BlogTaxonomyQuery = { __typename?: 'Query', adminBlogCategories: Array<{ __typename?: 'BlogCategory', id: string, slug: string, name: string, parentId?: string | null }>, adminBlogKeywords: Array<{ __typename?: 'BlogKeyword', id: string, slug: string, name: string }> };

export type BrowsePlaceFieldsFragment = { __typename?: 'BrowsePlace', id: string, kind: string, name: string, countryCode: string, regionCode?: string | null, slug: string, parentId?: string | null, routeCount: number };

export type BrowseCountriesQueryVariables = Exact<{ [key: string]: never; }>;


export type BrowseCountriesQuery = { __typename?: 'Query', browseCountries: Array<{ __typename?: 'BrowsePlace', id: string, kind: string, name: string, countryCode: string, regionCode?: string | null, slug: string, parentId?: string | null, routeCount: number }> };

export type BrowseCountryBySlugQueryVariables = Exact<{
  slug: Scalars['String']['input'];
}>;


export type BrowseCountryBySlugQuery = { __typename?: 'Query', browseCountryBySlug?: { __typename?: 'BrowsePlace', id: string, kind: string, name: string, countryCode: string, regionCode?: string | null, slug: string, parentId?: string | null, routeCount: number } | null };

export type BrowseRegionsByCountrySlugQueryVariables = Exact<{
  countrySlug: Scalars['String']['input'];
}>;


export type BrowseRegionsByCountrySlugQuery = { __typename?: 'Query', browseRegionsByCountrySlug: Array<{ __typename?: 'BrowsePlace', id: string, kind: string, name: string, countryCode: string, regionCode?: string | null, slug: string, parentId?: string | null, routeCount: number }> };

export type BrowseExploreRegionQueryVariables = Exact<{
  countrySlug: Scalars['String']['input'];
  regionSlug: Scalars['String']['input'];
}>;


export type BrowseExploreRegionQuery = { __typename?: 'Query', browseExploreRegion?: { __typename?: 'BrowseExploreRegionResult', country: { __typename?: 'BrowsePlace', id: string, kind: string, name: string, countryCode: string, regionCode?: string | null, slug: string, parentId?: string | null, routeCount: number }, region: { __typename?: 'BrowsePlace', id: string, kind: string, name: string, countryCode: string, regionCode?: string | null, slug: string, parentId?: string | null, routeCount: number } } | null };

export type GetGpxQuotaStatusQueryVariables = Exact<{ [key: string]: never; }>;


export type GetGpxQuotaStatusQuery = { __typename?: 'Query', getGPXQuotaStatus: { __typename?: 'QuotaStatus', feature: string, limit: number, used: number, remaining: number, resetDate: string, isExhausted: boolean } };

export type MaintenanceDraftReviewQueryVariables = Exact<{ [key: string]: never; }>;


export type MaintenanceDraftReviewQuery = { __typename?: 'Query', maintenanceDraftReview: { __typename?: 'MaintenanceDraftReview', schedules: Array<{ __typename?: 'AdminOemScheduleDraft', id: string, make: string, model?: string | null, variant?: string | null, taskName: string, intervalKm?: number | null, intervalDays?: number | null, priority: MaintenancePriority, isSafetyCritical: boolean, sourcePage?: string | null, sourceContext?: string | null, sourceTitle?: string | null, createdAt: string }>, specs: Array<{ __typename?: 'AdminMotorcycleSpecDraft', id: string, make: string, model?: string | null, variant?: string | null, specType: string, specName: string, valueNumeric: number, valueDisplay?: string | null, unit: string, isSafetyCritical: boolean, sourcePage?: string | null, sourceContext?: string | null, sourceTitle?: string | null, createdAt: string }> } };

export type PublicSavedTripsQueryVariables = Exact<{
  handle: Scalars['String']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type PublicSavedTripsQuery = { __typename?: 'Query', publicSavedTrips: { __typename?: 'TripConnection', edges: Array<{ __typename?: 'TripEdge', cursor: string, node: { __typename?: 'Trip', id: string, title: string, distanceM?: number | null, elevationGainM?: number | null, surfaceType?: string | null, isMotovaultPick: boolean, averageRating?: number | null, reviewCount: number, organiser: { __typename?: 'TripOrganiser', id: string, displayName: string, publicUsername?: string | null, avatarUrl?: string | null } } }>, pageInfo: { __typename?: 'TripPageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type SitemapPublishedTripsQueryVariables = Exact<{ [key: string]: never; }>;


export type SitemapPublishedTripsQuery = { __typename?: 'Query', sitemapPublishedTrips: Array<{ __typename?: 'SitemapTripEntry', countryCode: string, regionCode: string, slug: string, updatedAt: string }> };

export type WebTripBySlugQueryVariables = Exact<{
  country: Scalars['String']['input'];
  region: Scalars['String']['input'];
  slug: Scalars['String']['input'];
}>;


export type WebTripBySlugQuery = { __typename?: 'Query', tripBySlug?: { __typename?: 'Trip', id: string, slug?: string | null, title: string, description: string, difficulty: string, dayCount?: number | null, startLat?: number | null, startLng?: number | null, countryCode?: string | null, regionCode?: string | null, city?: string | null, distanceM?: number | null, elevationGainM?: number | null, estimatedDurationMinutes?: number | null, surfaceType?: string | null, isFeatured: boolean, isMotovaultPick: boolean, viewCount: number, polyline?: string | null, cloneCount: number, averageRating?: number | null, reviewCount: number, publishedAt?: string | null, updatedAt?: string | null, createdAt: string, organiser: { __typename?: 'TripOrganiser', id: string, displayName: string, publicUsername?: string | null }, waypoints?: Array<{ __typename?: 'TripWaypoint', sortOrder: number, dayIndex: number, type: string, name: string, lat: number, lng: number, notes?: string | null }> | null } | null };

export type WebTripPathByIdQueryVariables = Exact<{
  tripId: Scalars['ID']['input'];
}>;


export type WebTripPathByIdQuery = { __typename?: 'Query', tripDetail: { __typename?: 'Trip', id: string, slug?: string | null, countryCode?: string | null, regionCode?: string | null, title: string } };

export type WebTripReviewsQueryVariables = Exact<{
  country: Scalars['String']['input'];
  region: Scalars['String']['input'];
  slug: Scalars['String']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
}>;


export type WebTripReviewsQuery = { __typename?: 'Query', tripReviews: Array<{ __typename?: 'TripReview', id: string, rating: number, text?: string | null, conditionTags?: Array<string> | null, createdAt: string, author?: { __typename?: 'TripReviewAuthor', id: string, displayName: string, publicUsername?: string | null, avatarUrl?: string | null } | null, bike?: { __typename?: 'TripReviewBike', make: string, model: string, year: number } | null }> };

export const BlogPostFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BlogPostFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BlogPost"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledFor"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"}},{"kind":"Field","name":{"kind":"Name","value":"coverAlt"}},{"kind":"Field","name":{"kind":"Name","value":"specData"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"typeData"}},{"kind":"Field","name":{"kind":"Name","value":"translations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"excerpt"}},{"kind":"Field","name":{"kind":"Name","value":"seoTitle"}},{"kind":"Field","name":{"kind":"Name","value":"seoDescription"}},{"kind":"Field","name":{"kind":"Name","value":"bodyRaw"}},{"kind":"Field","name":{"kind":"Name","value":"faq"}},{"kind":"Field","name":{"kind":"Name","value":"readingTime"}},{"kind":"Field","name":{"kind":"Name","value":"wordCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"keywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<BlogPostFieldsFragment, unknown>;
export const BrowsePlaceFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BrowsePlaceFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BrowsePlace"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"routeCount"}}]}}]} as unknown as DocumentNode<BrowsePlaceFieldsFragment, unknown>;
export const AddDocumentCategoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddDocumentCategory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddDocumentCategoryInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addDocumentCategory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isHidden"}},{"kind":"Field","name":{"kind":"Name","value":"promptsExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<AddDocumentCategoryMutation, AddDocumentCategoryMutationVariables>;
export const AddExpensePhotoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddExpensePhoto"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddExpensePhotoInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addExpensePhoto"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"expenseId"}},{"kind":"Field","name":{"kind":"Name","value":"storagePath"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileSizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<AddExpensePhotoMutation, AddExpensePhotoMutationVariables>;
export const AddTaskPhotoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddTaskPhoto"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddTaskPhotoInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addTaskPhoto"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"storagePath"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileSizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<AddTaskPhotoMutation, AddTaskPhotoMutationVariables>;
export const AddWaypointDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddWaypoint"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateWaypointInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addWaypoint"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"tripId"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"periodOfDay"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<AddWaypointMutation, AddWaypointMutationVariables>;
export const AskTripAssistantDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AskTripAssistant"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AskTripAssistantInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"askTripAssistant"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]} as unknown as DocumentNode<AskTripAssistantMutation, AskTripAssistantMutationVariables>;
export const CancelGroupRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CancelGroupRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cancelGroupRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupRideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}}}]}]}}]} as unknown as DocumentNode<CancelGroupRideMutation, CancelGroupRideMutationVariables>;
export const CloneTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CloneTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cloneTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}]}]}}]} as unknown as DocumentNode<CloneTripMutation, CloneTripMutationVariables>;
export const CompleteMaintenanceTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompleteMaintenanceTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"CompleteMaintenanceTaskInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"createNextOccurrence"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completeMaintenanceTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}},{"kind":"Argument","name":{"kind":"Name","value":"createNextOccurrence"},"value":{"kind":"Variable","name":{"kind":"Name","value":"createNextOccurrence"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completed"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedMileage"}},{"kind":"Field","name":{"kind":"Name","value":"cost"}},{"kind":"Field","name":{"kind":"Name","value":"partsCost"}},{"kind":"Field","name":{"kind":"Name","value":"laborCost"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nextOccurrence"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","name":{"kind":"Name","value":"targetMileage"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isRecurring"}},{"kind":"Field","name":{"kind":"Name","value":"intervalKm"}},{"kind":"Field","name":{"kind":"Name","value":"intervalDays"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]} as unknown as DocumentNode<CompleteMaintenanceTaskMutation, CompleteMaintenanceTaskMutationVariables>;
export const CompleteOnboardingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompleteOnboarding"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CompleteOnboardingInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completeOnboarding"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"preferences"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<CompleteOnboardingMutation, CompleteOnboardingMutationVariables>;
export const CreateCommentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateComment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateCommentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createComment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"flaggedCount"}},{"kind":"Field","name":{"kind":"Name","value":"parentCommentId"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}}]}}]}}]} as unknown as DocumentNode<CreateCommentMutation, CreateCommentMutationVariables>;
export const CreateDiagnosticDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateDiagnostic"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateDiagnosticInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createDiagnostic"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"confidence"}},{"kind":"Field","name":{"kind":"Name","value":"relatedArticleId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"dataSharingOptedIn"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<CreateDiagnosticMutation, CreateDiagnosticMutationVariables>;
export const CreateDocumentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateDocument"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateDocumentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createDocument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"categoryId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"expiryDate"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"files"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"documentId"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"fileSizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]} as unknown as DocumentNode<CreateDocumentMutation, CreateDocumentMutationVariables>;
export const CreateFlagDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateFlag"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateFlagInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createFlag"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"articleId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"sectionReference"}},{"kind":"Field","name":{"kind":"Name","value":"comment"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<CreateFlagMutation, CreateFlagMutationVariables>;
export const CreateFuelLogDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateFuelLog"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateFuelLogInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createFuelLog"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"odometerKm"}},{"kind":"Field","name":{"kind":"Name","value":"fuelLitres"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"fuelType"}},{"kind":"Field","name":{"kind":"Name","value":"isPartial"}},{"kind":"Field","name":{"kind":"Name","value":"filledAt"}},{"kind":"Field","name":{"kind":"Name","value":"litresPer100Km"}},{"kind":"Field","name":{"kind":"Name","value":"mpgUs"}}]}}]}}]} as unknown as DocumentNode<CreateFuelLogMutation, CreateFuelLogMutationVariables>;
export const CreateGroupRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateGroupRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateGroupRideInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createGroupRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]} as unknown as DocumentNode<CreateGroupRideMutation, CreateGroupRideMutationVariables>;
export const CreateMaintenanceTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateMaintenanceTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateMaintenanceTaskInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createMaintenanceTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","name":{"kind":"Name","value":"targetMileage"}},{"kind":"Field","name":{"kind":"Name","value":"isRecurring"}},{"kind":"Field","name":{"kind":"Name","value":"intervalKm"}},{"kind":"Field","name":{"kind":"Name","value":"intervalDays"}},{"kind":"Field","name":{"kind":"Name","value":"remind30d"}},{"kind":"Field","name":{"kind":"Name","value":"remind7d"}},{"kind":"Field","name":{"kind":"Name","value":"remind1d"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<CreateMaintenanceTaskMutation, CreateMaintenanceTaskMutationVariables>;
export const CreateMotorcycleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateMotorcycle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateMotorcycleInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createMotorcycle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"year"}},{"kind":"Field","name":{"kind":"Name","value":"nickname"}},{"kind":"Field","name":{"kind":"Name","value":"variant"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<CreateMotorcycleMutation, CreateMotorcycleMutationVariables>;
export const CreateShareLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateShareLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateShareLinkInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createShareLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]} as unknown as DocumentNode<CreateShareLinkMutation, CreateShareLinkMutationVariables>;
export const CreateTripReviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateTripReview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateTripReviewInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createTripReview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"conditionTags"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"tripId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"bikeId"}}]}}]}}]} as unknown as DocumentNode<CreateTripReviewMutation, CreateTripReviewMutationVariables>;
export const CreateTripSuggestionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateTripSuggestion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateTripSuggestionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createTripSuggestion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"tripId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"periodOfDay"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}}]}}]}}]} as unknown as DocumentNode<CreateTripSuggestionMutation, CreateTripSuggestionMutationVariables>;
export const CreateTripWithWaypointsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateTripWithWaypoints"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateTripWithWaypointsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createTripWithWaypoints"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"datesPending"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"waypoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"tripId"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"periodOfDay"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}}]}}]}}]}}]} as unknown as DocumentNode<CreateTripWithWaypointsMutation, CreateTripWithWaypointsMutationVariables>;
export const CreateTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateTripInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}}]} as unknown as DocumentNode<CreateTripMutation, CreateTripMutationVariables>;
export const DeleteAccountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteAccount"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteAccount"}}]}}]} as unknown as DocumentNode<DeleteAccountMutation, DeleteAccountMutationVariables>;
export const DeleteCommentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteComment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"commentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteComment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"commentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"commentId"}}}]}]}}]} as unknown as DocumentNode<DeleteCommentMutation, DeleteCommentMutationVariables>;
export const DeleteDocumentCategoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteDocumentCategory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteDocumentCategory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteDocumentCategoryMutation, DeleteDocumentCategoryMutationVariables>;
export const DeleteDocumentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteDocument"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteDocument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteDocumentMutation, DeleteDocumentMutationVariables>;
export const DeleteExpensePhotoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteExpensePhoto"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"photoId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteExpensePhoto"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"photoId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"photoId"}}}]}]}}]} as unknown as DocumentNode<DeleteExpensePhotoMutation, DeleteExpensePhotoMutationVariables>;
export const DeleteExpenseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteExpense"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteExpense"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteExpenseMutation, DeleteExpenseMutationVariables>;
export const DeleteFuelLogDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteFuelLog"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteFuelLog"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteFuelLogMutation, DeleteFuelLogMutationVariables>;
export const DeleteMaintenanceTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteMaintenanceTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteMaintenanceTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteMaintenanceTaskMutation, DeleteMaintenanceTaskMutationVariables>;
export const DeleteMotorcycleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteMotorcycle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteMotorcycle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteMotorcycleMutation, DeleteMotorcycleMutationVariables>;
export const DeleteRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteRideMutation, DeleteRideMutationVariables>;
export const DeleteTaskPhotoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteTaskPhoto"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"photoId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteTaskPhoto"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"photoId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"photoId"}}}]}]}}]} as unknown as DocumentNode<DeleteTaskPhotoMutation, DeleteTaskPhotoMutationVariables>;
export const DeleteTripReviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteTripReview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reviewId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteTripReview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"reviewId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reviewId"}}}]}]}}]} as unknown as DocumentNode<DeleteTripReviewMutation, DeleteTripReviewMutationVariables>;
export const DeleteTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}]}]}}]} as unknown as DocumentNode<DeleteTripMutation, DeleteTripMutationVariables>;
export const EndRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EndRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"EndRideInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"endRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ride"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"endedAt"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"maxSpeedMps"}},{"kind":"Field","name":{"kind":"Name","value":"avgSpeedMps"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGain"}},{"kind":"Field","name":{"kind":"Name","value":"elevationLoss"}},{"kind":"Field","name":{"kind":"Name","value":"pausedDurationS"}},{"kind":"Field","name":{"kind":"Name","value":"autoPausedDurationS"}},{"kind":"Field","name":{"kind":"Name","value":"gpsQuality"}},{"kind":"Field","name":{"kind":"Name","value":"routePolyline"}},{"kind":"Field","name":{"kind":"Name","value":"mileageApplied"}}]}},{"kind":"Field","name":{"kind":"Name","value":"triggeredMaintenanceTasks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}}]}}]}}]}}]} as unknown as DocumentNode<EndRideMutation, EndRideMutationVariables>;
export const ExportTripGpxDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ExportTripGpx"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"country"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"region"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exportTripGPX"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"country"},"value":{"kind":"Variable","name":{"kind":"Name","value":"country"}}},{"kind":"Argument","name":{"kind":"Name","value":"region"},"value":{"kind":"Variable","name":{"kind":"Name","value":"region"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GPXExportSuccess"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fileUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GPXExportError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"quotaRemaining"}},{"kind":"Field","name":{"kind":"Name","value":"upgradeUrl"}}]}}]}}]}}]} as unknown as DocumentNode<ExportTripGpxMutation, ExportTripGpxMutationVariables>;
export const FlagCommentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FlagComment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"commentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"flagComment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"commentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"commentId"}}}]}]}}]} as unknown as DocumentNode<FlagCommentMutation, FlagCommentMutationVariables>;
export const FollowRiderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FollowRider"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FollowRiderInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"followRider"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"followerId"}},{"kind":"Field","name":{"kind":"Name","value":"followingId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<FollowRiderMutation, FollowRiderMutationVariables>;
export const GenerateArticleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"GenerateArticle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GenerateArticleInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"generateArticle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"contentJson"}},{"kind":"Field","name":{"kind":"Name","value":"readTime"}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}}]}}]}}]} as unknown as DocumentNode<GenerateArticleMutation, GenerateArticleMutationVariables>;
export const GenerateBikeHealthReportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"GenerateBikeHealthReport"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GenerateReportInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"generateBikeHealthReport"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"pdfUrl"}},{"kind":"Field","name":{"kind":"Name","value":"iapTransactionId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]}}]} as unknown as DocumentNode<GenerateBikeHealthReportMutation, GenerateBikeHealthReportMutationVariables>;
export const GenerateOnboardingInsightsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"GenerateOnboardingInsights"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GenerateInsightsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"generateOnboardingInsights"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]}}]} as unknown as DocumentNode<GenerateOnboardingInsightsMutation, GenerateOnboardingInsightsMutationVariables>;
export const ImportOemScheduleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ImportOemSchedule"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"importOemSchedule"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}]}]}}]} as unknown as DocumentNode<ImportOemScheduleMutation, ImportOemScheduleMutationVariables>;
export const InviteToTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InviteToTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"invitedUserId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"inviteToTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}},{"kind":"Argument","name":{"kind":"Name","value":"invitedUserId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"invitedUserId"}}}]}]}}]} as unknown as DocumentNode<InviteToTripMutation, InviteToTripMutationVariables>;
export const JoinGroupRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinGroupRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinGroupRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupRideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}}}]}]}}]} as unknown as DocumentNode<JoinGroupRideMutation, JoinGroupRideMutationVariables>;
export const JoinPremiumWaitlistDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinPremiumWaitlist"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"feature"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinPremiumWaitlist"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"feature"},"value":{"kind":"Variable","name":{"kind":"Name","value":"feature"}}}]}]}}]} as unknown as DocumentNode<JoinPremiumWaitlistMutation, JoinPremiumWaitlistMutationVariables>;
export const JoinTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"JoinTripInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<JoinTripMutation, JoinTripMutationVariables>;
export const LeaveGroupRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LeaveGroupRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"leaveGroupRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupRideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}}}]}]}}]} as unknown as DocumentNode<LeaveGroupRideMutation, LeaveGroupRideMutationVariables>;
export const LeaveTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LeaveTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"leaveTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}]}]}}]} as unknown as DocumentNode<LeaveTripMutation, LeaveTripMutationVariables>;
export const LogExpenseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LogExpense"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LogExpenseInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logExpense"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"itemName"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<LogExpenseMutation, LogExpenseMutationVariables>;
export const MarkArticleReadDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarkArticleRead"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"articleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"markArticleRead"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"articleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"articleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"articleId"}},{"kind":"Field","name":{"kind":"Name","value":"articleRead"}},{"kind":"Field","name":{"kind":"Name","value":"quizCompleted"}},{"kind":"Field","name":{"kind":"Name","value":"quizBestScore"}},{"kind":"Field","name":{"kind":"Name","value":"firstReadAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastReadAt"}}]}}]}}]} as unknown as DocumentNode<MarkArticleReadMutation, MarkArticleReadMutationVariables>;
export const PublishAsTemplateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PublishAsTemplate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publishAsTemplate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"isTemplate"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<PublishAsTemplateMutation, PublishAsTemplateMutationVariables>;
export const PublishTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PublishTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publishTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<PublishTripMutation, PublishTripMutationVariables>;
export const RegenerateRideSummaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RegenerateRideSummary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"regenerateRideSummary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"rideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"rideId"}},{"kind":"Field","name":{"kind":"Name","value":"summaryText"}},{"kind":"Field","name":{"kind":"Name","value":"generationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<RegenerateRideSummaryMutation, RegenerateRideSummaryMutationVariables>;
export const RemoveWaypointDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveWaypoint"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"waypointId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removeWaypoint"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"waypointId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"waypointId"}}}]}]}}]} as unknown as DocumentNode<RemoveWaypointMutation, RemoveWaypointMutationVariables>;
export const ReorderWaypointsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReorderWaypoints"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ReorderWaypointsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reorderWaypoints"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<ReorderWaypointsMutation, ReorderWaypointsMutationVariables>;
export const RequestDataExportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RequestDataExport"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requestDataExport"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"requestedAt"}}]}}]}}]} as unknown as DocumentNode<RequestDataExportMutation, RequestDataExportMutationVariables>;
export const RespondToTripInviteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RespondToTripInvite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inviteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"accept"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"respondToTripInvite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"inviteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inviteId"}}},{"kind":"Argument","name":{"kind":"Name","value":"accept"},"value":{"kind":"Variable","name":{"kind":"Name","value":"accept"}}}]}]}}]} as unknown as DocumentNode<RespondToTripInviteMutation, RespondToTripInviteMutationVariables>;
export const RespondToTripSuggestionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RespondToTripSuggestion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RespondToTripSuggestionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"respondToTripSuggestion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"decidedBy"}},{"kind":"Field","name":{"kind":"Name","value":"decidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"decidedNote"}},{"kind":"Field","name":{"kind":"Name","value":"waypointId"}}]}}]}}]} as unknown as DocumentNode<RespondToTripSuggestionMutation, RespondToTripSuggestionMutationVariables>;
export const RevokeShareLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RevokeShareLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"linkId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"revokeShareLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"linkId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"linkId"}}}]}]}}]} as unknown as DocumentNode<RevokeShareLinkMutation, RevokeShareLinkMutationVariables>;
export const RotateTripShareTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RotateTripShareToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rotateTripShareToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}]}]}}]} as unknown as DocumentNode<RotateTripShareTokenMutation, RotateTripShareTokenMutationVariables>;
export const SaveTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saveTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}]}]}}]} as unknown as DocumentNode<SaveTripMutation, SaveTripMutationVariables>;
export const SetTripParticipantRoleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetTripParticipantRole"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SetParticipantRoleInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setTripParticipantRole"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<SetTripParticipantRoleMutation, SetTripParticipantRoleMutationVariables>;
export const ShareRideAsTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ShareRideAsTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ShareRideAsTripInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shareRideAsTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}}]}}]}}]} as unknown as DocumentNode<ShareRideAsTripMutation, ShareRideAsTripMutationVariables>;
export const ShareRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ShareRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sharedWithUserId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shareRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"rideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}}},{"kind":"Argument","name":{"kind":"Name","value":"sharedWithUserId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sharedWithUserId"}}}]}]}}]} as unknown as DocumentNode<ShareRideMutation, ShareRideMutationVariables>;
export const StartRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StartRideInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}}]}}]}}]} as unknown as DocumentNode<StartRideMutation, StartRideMutationVariables>;
export const SubmitDiagnosticDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SubmitDiagnostic"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SubmitDiagnosticInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"submitDiagnostic"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"confidence"}},{"kind":"Field","name":{"kind":"Name","value":"relatedArticleId"}},{"kind":"Field","name":{"kind":"Name","value":"resultJson"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"photoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<SubmitDiagnosticMutation, SubmitDiagnosticMutationVariables>;
export const TrackAffiliateClickDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"TrackAffiliateClick"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"TrackClickInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trackAffiliateClick"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"partner"}},{"kind":"Field","name":{"kind":"Name","value":"affiliateUrl"}},{"kind":"Field","name":{"kind":"Name","value":"productUrl"}},{"kind":"Field","name":{"kind":"Name","value":"tracked"}}]}}]}}]} as unknown as DocumentNode<TrackAffiliateClickMutation, TrackAffiliateClickMutationVariables>;
export const UnfollowRiderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnfollowRider"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UnfollowRiderInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unfollowRider"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<UnfollowRiderMutation, UnfollowRiderMutationVariables>;
export const UnpublishTemplateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnpublishTemplate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unpublishTemplate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}]}]}}]} as unknown as DocumentNode<UnpublishTemplateMutation, UnpublishTemplateMutationVariables>;
export const UnsaveTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnsaveTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unsaveTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}]}]}}]} as unknown as DocumentNode<UnsaveTripMutation, UnsaveTripMutationVariables>;
export const UnshareRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnshareRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sharedWithUserId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unshareRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"rideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}}},{"kind":"Argument","name":{"kind":"Name","value":"sharedWithUserId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sharedWithUserId"}}}]}]}}]} as unknown as DocumentNode<UnshareRideMutation, UnshareRideMutationVariables>;
export const UpdateDocumentCategoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateDocumentCategory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateDocumentCategoryInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateDocumentCategory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isHidden"}},{"kind":"Field","name":{"kind":"Name","value":"promptsExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateDocumentCategoryMutation, UpdateDocumentCategoryMutationVariables>;
export const UpdateDocumentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateDocument"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateDocumentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateDocument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"categoryId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"expiryDate"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateDocumentMutation, UpdateDocumentMutationVariables>;
export const UpdateMotorcycleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateMotorcycle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateMotorcycleInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateMotorcycle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"year"}},{"kind":"Field","name":{"kind":"Name","value":"nickname"}},{"kind":"Field","name":{"kind":"Name","value":"variant"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"primaryPhotoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"currentMileage"}},{"kind":"Field","name":{"kind":"Name","value":"mileageUnit"}},{"kind":"Field","name":{"kind":"Name","value":"mileageUpdatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"purchaseDate"}},{"kind":"Field","name":{"kind":"Name","value":"vin"}},{"kind":"Field","name":{"kind":"Name","value":"recallCount"}},{"kind":"Field","name":{"kind":"Name","value":"recallLastCheckedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateMotorcycleMutation, UpdateMotorcycleMutationVariables>;
export const UpdateMyProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateMyProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateProfileInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateMyProfile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"followerCount"}},{"kind":"Field","name":{"kind":"Name","value":"followingCount"}}]}}]}}]} as unknown as DocumentNode<UpdateMyProfileMutation, UpdateMyProfileMutationVariables>;
export const UpdateParticipantStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateParticipantStatus"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateParticipantStatusInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateParticipantStatus"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<UpdateParticipantStatusMutation, UpdateParticipantStatusMutationVariables>;
export const UpdateRideVisibilityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateRideVisibility"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"visibility"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateRideVisibility"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"rideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}}},{"kind":"Argument","name":{"kind":"Name","value":"visibility"},"value":{"kind":"Variable","name":{"kind":"Name","value":"visibility"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}}]}}]}}]} as unknown as DocumentNode<UpdateRideVisibilityMutation, UpdateRideVisibilityMutationVariables>;
export const UpdateRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateRideInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"mileageApplied"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}}]}}]}}]} as unknown as DocumentNode<UpdateRideMutation, UpdateRideMutationVariables>;
export const UpdateTripDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateTrip"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateTripInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateTrip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"waypoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"tripId"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"periodOfDay"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateTripMutation, UpdateTripMutationVariables>;
export const UpdateUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateUserInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}},{"kind":"Field","name":{"kind":"Name","value":"preferences"}},{"kind":"Field","name":{"kind":"Name","value":"measurementSystem"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}}]}}]}}]} as unknown as DocumentNode<UpdateUserMutation, UpdateUserMutationVariables>;
export const UpdateWaypointDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateWaypoint"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateWaypointInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateWaypoint"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"periodOfDay"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}}]}}]}}]} as unknown as DocumentNode<UpdateWaypointMutation, UpdateWaypointMutationVariables>;
export const UploadWaypointsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UploadWaypoints"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UploadWaypointsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"uploadWaypoints"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<UploadWaypointsMutation, UploadWaypointsMutationVariables>;
export const AllMaintenanceTasksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AllMaintenanceTasks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"allMaintenanceTasks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","name":{"kind":"Name","value":"targetMileage"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}},{"kind":"Field","name":{"kind":"Name","value":"remind30d"}},{"kind":"Field","name":{"kind":"Name","value":"remind7d"}},{"kind":"Field","name":{"kind":"Name","value":"remind1d"}}]}}]}}]} as unknown as DocumentNode<AllMaintenanceTasksQuery, AllMaintenanceTasksQueryVariables>;
export const ArticleBySlugFullDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ArticleBySlugFull"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"articleBySlugFull"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"contentJson"}},{"kind":"Field","name":{"kind":"Name","value":"readTime"}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<ArticleBySlugFullQuery, ArticleBySlugFullQueryVariables>;
export const DiagnosticByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DiagnosticById"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"diagnosticById"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"confidence"}},{"kind":"Field","name":{"kind":"Name","value":"relatedArticleId"}},{"kind":"Field","name":{"kind":"Name","value":"resultJson"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"photoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"dataSharingOptedIn"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<DiagnosticByIdQuery, DiagnosticByIdQueryVariables>;
export const DiscoverRiderTripsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DiscoverRiderTrips"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"discoverRiderTrips"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"coverImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"waypoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}}]} as unknown as DocumentNode<DiscoverRiderTripsQuery, DiscoverRiderTripsQueryVariables>;
export const DocumentCategoriesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DocumentCategories"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeHidden"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"documentCategories"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"includeHidden"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeHidden"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isHidden"}},{"kind":"Field","name":{"kind":"Name","value":"promptsExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<DocumentCategoriesQuery, DocumentCategoriesQueryVariables>;
export const GetDocumentSignedUrlDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetDocumentSignedUrl"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"fileId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"download"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getDocumentSignedUrl"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"fileId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"fileId"}}},{"kind":"Argument","name":{"kind":"Name","value":"download"},"value":{"kind":"Variable","name":{"kind":"Name","value":"download"}}}]}]}}]} as unknown as DocumentNode<GetDocumentSignedUrlQuery, GetDocumentSignedUrlQueryVariables>;
export const DocumentsByMotorcycleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DocumentsByMotorcycle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"documents"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"categoryId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"expiryDate"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"files"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"documentId"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"fileSizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]} as unknown as DocumentNode<DocumentsByMotorcycleQuery, DocumentsByMotorcycleQueryVariables>;
export const ExpenseDashboardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExpenseDashboard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"expenseDashboard"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currentYearTotal"}},{"kind":"Field","name":{"kind":"Name","value":"previousYearTotal"}},{"kind":"Field","name":{"kind":"Name","value":"allTimeTotal"}},{"kind":"Field","name":{"kind":"Name","value":"expenseCount"}},{"kind":"Field","name":{"kind":"Name","value":"monthlyBuckets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"month"}},{"kind":"Field","name":{"kind":"Name","value":"year"}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categoryTotals"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}}]}}]}}]} as unknown as DocumentNode<ExpenseDashboardQuery, ExpenseDashboardQueryVariables>;
export const ExpensePhotosDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExpensePhotos"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"expenseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"expensePhotos"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"expenseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"expenseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"expenseId"}},{"kind":"Field","name":{"kind":"Name","value":"storagePath"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileSizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<ExpensePhotosQuery, ExpensePhotosQueryVariables>;
export const ExpensesByMotorcycleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExpensesByMotorcycle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"year"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"expenses"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}},{"kind":"Argument","name":{"kind":"Name","value":"year"},"value":{"kind":"Variable","name":{"kind":"Name","value":"year"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ytdTotal"}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"expenses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ExpensesByMotorcycleQuery, ExpensesByMotorcycleQueryVariables>;
export const ExpiringDocumentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExpiringDocuments"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"withinDays"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"expiringDocuments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"withinDays"},"value":{"kind":"Variable","name":{"kind":"Name","value":"withinDays"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"categoryId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"expiryDate"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}}]}}]}}]} as unknown as DocumentNode<ExpiringDocumentsQuery, ExpiringDocumentsQueryVariables>;
export const FuelLogsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"FuelLogs"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fuelLogs"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"odometerKm"}},{"kind":"Field","name":{"kind":"Name","value":"fuelLitres"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"fuelType"}},{"kind":"Field","name":{"kind":"Name","value":"isPartial"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"filledAt"}},{"kind":"Field","name":{"kind":"Name","value":"kmSincePrevious"}},{"kind":"Field","name":{"kind":"Name","value":"litresPer100Km"}},{"kind":"Field","name":{"kind":"Name","value":"mpgUs"}}]}}]}}]} as unknown as DocumentNode<FuelLogsQuery, FuelLogsQueryVariables>;
export const GetArticleBySlugDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetArticleBySlug"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"articleBySlug"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetArticleBySlugQuery, GetArticleBySlugQueryVariables>;
export const GetCommentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetComments"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"routeId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getComments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"rideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}}},{"kind":"Argument","name":{"kind":"Name","value":"routeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"routeId"}}},{"kind":"Argument","name":{"kind":"Name","value":"groupRideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}}},{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"comments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"flaggedCount"}},{"kind":"Field","name":{"kind":"Name","value":"parentCommentId"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"replies"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"flaggedCount"}},{"kind":"Field","name":{"kind":"Name","value":"parentCommentId"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<GetCommentsQuery, GetCommentsQueryVariables>;
export const GetFollowersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFollowers"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getFollowers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"followerId"}},{"kind":"Field","name":{"kind":"Name","value":"followingId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}},{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<GetFollowersQuery, GetFollowersQueryVariables>;
export const GetFollowingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFollowing"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getFollowing"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"followerId"}},{"kind":"Field","name":{"kind":"Name","value":"followingId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}},{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<GetFollowingQuery, GetFollowingQueryVariables>;
export const GetGroupRidesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetGroupRides"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getGroupRides"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"dateTime"}},{"kind":"Field","name":{"kind":"Name","value":"meetingPointLat"}},{"kind":"Field","name":{"kind":"Name","value":"meetingPointLng"}},{"kind":"Field","name":{"kind":"Name","value":"meetingPointName"}},{"kind":"Field","name":{"kind":"Name","value":"routeId"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}}]} as unknown as DocumentNode<GetGroupRidesQuery, GetGroupRidesQueryVariables>;
export const GetOnboardingRevealDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetOnboardingReveal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"make"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"year"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"model"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"onboardingReveal"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"make"},"value":{"kind":"Variable","name":{"kind":"Name","value":"make"}}},{"kind":"Argument","name":{"kind":"Name","value":"year"},"value":{"kind":"Variable","name":{"kind":"Name","value":"year"}}},{"kind":"Argument","name":{"kind":"Name","value":"model"},"value":{"kind":"Variable","name":{"kind":"Name","value":"model"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"year"}},{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"recallCount"}},{"kind":"Field","name":{"kind":"Name","value":"recallsChecked"}},{"kind":"Field","name":{"kind":"Name","value":"recalls"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"component"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"oemTaskCount"}},{"kind":"Field","name":{"kind":"Name","value":"projectedYearlyCostEur"}},{"kind":"Field","name":{"kind":"Name","value":"riderCount"}},{"kind":"Field","name":{"kind":"Name","value":"insights"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"knownIssues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetOnboardingRevealQuery, GetOnboardingRevealQueryVariables>;
export const GetPublicRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPublicRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getPublicRide"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"endedAt"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"maxSpeedMps"}},{"kind":"Field","name":{"kind":"Name","value":"avgSpeedMps"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGain"}},{"kind":"Field","name":{"kind":"Name","value":"elevationLoss"}},{"kind":"Field","name":{"kind":"Name","value":"pausedDurationS"}},{"kind":"Field","name":{"kind":"Name","value":"autoPausedDurationS"}},{"kind":"Field","name":{"kind":"Name","value":"durationS"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"routePolyline"}},{"kind":"Field","name":{"kind":"Name","value":"routeThumbnailUri"}},{"kind":"Field","name":{"kind":"Name","value":"gpsQuality"}},{"kind":"Field","name":{"kind":"Name","value":"mileageApplied"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<GetPublicRideQuery, GetPublicRideQueryVariables>;
export const GetRideWaypointsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRideWaypoints"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"maxPoints"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideWaypoints"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"rideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"rideId"}}},{"kind":"Argument","name":{"kind":"Name","value":"maxPoints"},"value":{"kind":"Variable","name":{"kind":"Name","value":"maxPoints"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordedAt"}},{"kind":"Field","name":{"kind":"Name","value":"latitude"}},{"kind":"Field","name":{"kind":"Name","value":"longitude"}},{"kind":"Field","name":{"kind":"Name","value":"altitude"}},{"kind":"Field","name":{"kind":"Name","value":"speedMps"}}]}}]}}]} as unknown as DocumentNode<GetRideWaypointsQuery, GetRideWaypointsQueryVariables>;
export const GetRideDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRide"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ride"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"endedAt"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"maxSpeedMps"}},{"kind":"Field","name":{"kind":"Name","value":"avgSpeedMps"}},{"kind":"Field","name":{"kind":"Name","value":"maxLeanAngle"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGain"}},{"kind":"Field","name":{"kind":"Name","value":"elevationLoss"}},{"kind":"Field","name":{"kind":"Name","value":"pausedDurationS"}},{"kind":"Field","name":{"kind":"Name","value":"autoPausedDurationS"}},{"kind":"Field","name":{"kind":"Name","value":"durationS"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"routePolyline"}},{"kind":"Field","name":{"kind":"Name","value":"routeThumbnailUri"}},{"kind":"Field","name":{"kind":"Name","value":"gpsQuality"}},{"kind":"Field","name":{"kind":"Name","value":"mileageApplied"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<GetRideQuery, GetRideQueryVariables>;
export const GetRiderProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRiderProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getRiderProfile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}},{"kind":"Field","name":{"kind":"Name","value":"followerCount"}},{"kind":"Field","name":{"kind":"Name","value":"followingCount"}},{"kind":"Field","name":{"kind":"Name","value":"isFollowing"}},{"kind":"Field","name":{"kind":"Name","value":"bikes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"year"}},{"kind":"Field","name":{"kind":"Name","value":"nickname"}}]}},{"kind":"Field","name":{"kind":"Name","value":"rideStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalRides"}},{"kind":"Field","name":{"kind":"Name","value":"totalDistance"}},{"kind":"Field","name":{"kind":"Name","value":"joinDate"}}]}}]}}]}}]} as unknown as DocumentNode<GetRiderProfileQuery, GetRiderProfileQueryVariables>;
export const GetTripsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetTrips"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getTrips"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"coverImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"waypoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}}]} as unknown as DocumentNode<GetTripsQuery, GetTripsQueryVariables>;
export const GroupRideDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GroupRideDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groupRideDetail"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupRideId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupRideId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"dateTime"}},{"kind":"Field","name":{"kind":"Name","value":"meetingPointLat"}},{"kind":"Field","name":{"kind":"Name","value":"meetingPointLng"}},{"kind":"Field","name":{"kind":"Name","value":"meetingPointName"}},{"kind":"Field","name":{"kind":"Name","value":"routeId"}},{"kind":"Field","name":{"kind":"Name","value":"routeDescription"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}},{"kind":"Field","name":{"kind":"Name","value":"joinedAt"}}]}}]}}]}}]} as unknown as DocumentNode<GroupRideDetailQuery, GroupRideDetailQueryVariables>;
export const IsTripSavedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"IsTripSaved"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isTripSaved"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}]}]}}]} as unknown as DocumentNode<IsTripSavedQuery, IsTripSavedQueryVariables>;
export const ListPopularArticlesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ListPopularArticles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"popularArticles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"readTime"}},{"kind":"Field","name":{"kind":"Name","value":"keywords"}}]}}]}}]} as unknown as DocumentNode<ListPopularArticlesQuery, ListPopularArticlesQueryVariables>;
export const MaintenanceTaskHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MaintenanceTaskHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maintenanceTaskHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","name":{"kind":"Name","value":"targetMileage"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"partsNeeded"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedMileage"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"oemScheduleId"}},{"kind":"Field","name":{"kind":"Name","value":"intervalKm"}},{"kind":"Field","name":{"kind":"Name","value":"intervalDays"}},{"kind":"Field","name":{"kind":"Name","value":"isRecurring"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<MaintenanceTaskHistoryQuery, MaintenanceTaskHistoryQueryVariables>;
export const MaintenanceTasksByMotorcycleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MaintenanceTasksByMotorcycle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maintenanceTasks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","name":{"kind":"Name","value":"targetMileage"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"partsNeeded"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedMileage"}},{"kind":"Field","name":{"kind":"Name","value":"cost"}},{"kind":"Field","name":{"kind":"Name","value":"partsCost"}},{"kind":"Field","name":{"kind":"Name","value":"laborCost"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"isRecurring"}},{"kind":"Field","name":{"kind":"Name","value":"intervalKm"}},{"kind":"Field","name":{"kind":"Name","value":"intervalDays"}},{"kind":"Field","name":{"kind":"Name","value":"remind30d"}},{"kind":"Field","name":{"kind":"Name","value":"remind7d"}},{"kind":"Field","name":{"kind":"Name","value":"remind1d"}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"storagePath"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<MaintenanceTasksByMotorcycleQuery, MaintenanceTasksByMotorcycleQueryVariables>;
export const MakeStatsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MakeStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"makeStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"riders"}},{"kind":"Field","name":{"kind":"Name","value":"models"}},{"kind":"Field","name":{"kind":"Name","value":"totalBikes"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}}]}}]}}]} as unknown as DocumentNode<MakeStatsQuery, MakeStatsQueryVariables>;
export const MeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"preferences"}},{"kind":"Field","name":{"kind":"Name","value":"measurementSystem"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"followerCount"}},{"kind":"Field","name":{"kind":"Name","value":"followingCount"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<MeQuery, MeQueryVariables>;
export const MotorcycleMakesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MotorcycleMakes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"motorcycleMakes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"makeId"}},{"kind":"Field","name":{"kind":"Name","value":"makeName"}},{"kind":"Field","name":{"kind":"Name","value":"isPopular"}}]}}]}}]} as unknown as DocumentNode<MotorcycleMakesQuery, MotorcycleMakesQueryVariables>;
export const MotorcycleModelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MotorcycleModels"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"makeId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"year"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"motorcycleModels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"makeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"makeId"}}},{"kind":"Argument","name":{"kind":"Name","value":"year"},"value":{"kind":"Variable","name":{"kind":"Name","value":"year"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modelId"}},{"kind":"Field","name":{"kind":"Name","value":"modelName"}}]}}]}}]} as unknown as DocumentNode<MotorcycleModelsQuery, MotorcycleModelsQueryVariables>;
export const MotorcycleRecallsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MotorcycleRecalls"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"motorcycleRecalls"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"checkedAt"}},{"kind":"Field","name":{"kind":"Name","value":"vinUsed"}},{"kind":"Field","name":{"kind":"Name","value":"recalls"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"campaignNumber"}},{"kind":"Field","name":{"kind":"Name","value":"reportDate"}},{"kind":"Field","name":{"kind":"Name","value":"component"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"consequence"}},{"kind":"Field","name":{"kind":"Name","value":"remedy"}}]}}]}}]}}]} as unknown as DocumentNode<MotorcycleRecallsQuery, MotorcycleRecallsQueryVariables>;
export const MyDiagnosticsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyDiagnostics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myDiagnostics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"confidence"}},{"kind":"Field","name":{"kind":"Name","value":"relatedArticleId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"dataSharingOptedIn"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<MyDiagnosticsQuery, MyDiagnosticsQueryVariables>;
export const GetMyHealthReportsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMyHealthReports"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getMyHealthReports"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"pdfUrl"}},{"kind":"Field","name":{"kind":"Name","value":"iapTransactionId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]}}]} as unknown as DocumentNode<GetMyHealthReportsQuery, GetMyHealthReportsQueryVariables>;
export const MyMotorcyclesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyMotorcycles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myMotorcycles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"year"}},{"kind":"Field","name":{"kind":"Name","value":"nickname"}},{"kind":"Field","name":{"kind":"Name","value":"variant"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"primaryPhotoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"currentMileage"}},{"kind":"Field","name":{"kind":"Name","value":"mileageUnit"}},{"kind":"Field","name":{"kind":"Name","value":"mileageUpdatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"purchaseDate"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"engineCc"}},{"kind":"Field","name":{"kind":"Name","value":"vin"}},{"kind":"Field","name":{"kind":"Name","value":"recallCount"}},{"kind":"Field","name":{"kind":"Name","value":"recallLastCheckedAt"}},{"kind":"Field","name":{"kind":"Name","value":"odometerSyncSource"}},{"kind":"Field","name":{"kind":"Name","value":"odometerLastRideId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<MyMotorcyclesQuery, MyMotorcyclesQueryVariables>;
export const MyProgressDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyProgress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myProgress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"articleId"}},{"kind":"Field","name":{"kind":"Name","value":"articleRead"}},{"kind":"Field","name":{"kind":"Name","value":"quizCompleted"}},{"kind":"Field","name":{"kind":"Name","value":"quizBestScore"}},{"kind":"Field","name":{"kind":"Name","value":"firstReadAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastReadAt"}}]}}]}}]} as unknown as DocumentNode<MyProgressQuery, MyProgressQueryVariables>;
export const MyRidesForHeatmapDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyRidesForHeatmap"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myRides"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"routePolyline"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<MyRidesForHeatmapQuery, MyRidesForHeatmapQueryVariables>;
export const MyRidesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyRides"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myRides"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"endedAt"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"maxSpeedMps"}},{"kind":"Field","name":{"kind":"Name","value":"avgSpeedMps"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGain"}},{"kind":"Field","name":{"kind":"Name","value":"pausedDurationS"}},{"kind":"Field","name":{"kind":"Name","value":"autoPausedDurationS"}},{"kind":"Field","name":{"kind":"Name","value":"durationS"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"routePolyline"}},{"kind":"Field","name":{"kind":"Name","value":"routeThumbnailUri"}},{"kind":"Field","name":{"kind":"Name","value":"gpsQuality"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<MyRidesQuery, MyRidesQueryVariables>;
export const MyShareLinksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyShareLinks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myShareLinks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleId"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<MyShareLinksQuery, MyShareLinksQueryVariables>;
export const MyTripsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyTrips"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myTrips"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"coverImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"waypoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}}]} as unknown as DocumentNode<MyTripsQuery, MyTripsQueryVariables>;
export const OemSchedulesPreviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"OemSchedulesPreview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"make"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"model"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"year"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"variant"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"oemSchedulesPreview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"make"},"value":{"kind":"Variable","name":{"kind":"Name","value":"make"}}},{"kind":"Argument","name":{"kind":"Name","value":"model"},"value":{"kind":"Variable","name":{"kind":"Name","value":"model"}}},{"kind":"Argument","name":{"kind":"Name","value":"year"},"value":{"kind":"Variable","name":{"kind":"Name","value":"year"}}},{"kind":"Argument","name":{"kind":"Name","value":"variant"},"value":{"kind":"Variable","name":{"kind":"Name","value":"variant"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"taskName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"intervalKm"}},{"kind":"Field","name":{"kind":"Name","value":"intervalDays"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}}]} as unknown as DocumentNode<OemSchedulesPreviewQuery, OemSchedulesPreviewQueryVariables>;
export const RideOverviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RideOverview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideOverview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lastRide"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"durationS"}},{"kind":"Field","name":{"kind":"Name","value":"maxSpeedMps"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"motorcycleName"}},{"kind":"Field","name":{"kind":"Name","value":"summaryTitle"}}]}},{"kind":"Field","name":{"kind":"Name","value":"last7Days"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideCount"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"durationS"}}]}},{"kind":"Field","name":{"kind":"Name","value":"last30Days"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideCount"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"durationS"}}]}},{"kind":"Field","name":{"kind":"Name","value":"thisWeek"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideCount"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"durationS"}}]}},{"kind":"Field","name":{"kind":"Name","value":"thisMonth"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rideCount"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"durationS"}}]}},{"kind":"Field","name":{"kind":"Name","value":"dailyDistances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}}]}},{"kind":"Field","name":{"kind":"Name","value":"currentStreak"}},{"kind":"Field","name":{"kind":"Name","value":"personalRecords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordType"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"achievedAt"}},{"kind":"Field","name":{"kind":"Name","value":"previousValue"}},{"kind":"Field","name":{"kind":"Name","value":"rideId"}}]}}]}}]}}]} as unknown as DocumentNode<RideOverviewQuery, RideOverviewQueryVariables>;
export const SavedTripsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SavedTrips"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"savedTrips"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"dayCount"}},{"kind":"Field","name":{"kind":"Name","value":"startLat"}},{"kind":"Field","name":{"kind":"Name","value":"startLng"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGainM"}},{"kind":"Field","name":{"kind":"Name","value":"surfaceType"}},{"kind":"Field","name":{"kind":"Name","value":"isFeatured"}},{"kind":"Field","name":{"kind":"Name","value":"isMotovaultPick"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"cloneCount"}},{"kind":"Field","name":{"kind":"Name","value":"averageRating"}},{"kind":"Field","name":{"kind":"Name","value":"reviewCount"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"isTemplate"}},{"kind":"Field","name":{"kind":"Name","value":"isSaved"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}}]} as unknown as DocumentNode<SavedTripsQuery, SavedTripsQueryVariables>;
export const SearchArticlesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchArticles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SearchArticlesInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchArticles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"keywords"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}},{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<SearchArticlesQuery, SearchArticlesQueryVariables>;
export const SearchTypeaheadDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchTypeahead"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"q"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchTypeahead"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"q"},"value":{"kind":"Variable","name":{"kind":"Name","value":"q"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"routes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}}]}},{"kind":"Field","name":{"kind":"Name","value":"places"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"population"}}]}}]}}]}}]} as unknown as DocumentNode<SearchTypeaheadQuery, SearchTypeaheadQueryVariables>;
export const SpendingSummaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SpendingSummary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"spendingSummary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"motorcycleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"motorcycleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"thisYear"}},{"kind":"Field","name":{"kind":"Name","value":"allTime"}}]}}]}}]} as unknown as DocumentNode<SpendingSummaryQuery, SpendingSummaryQueryVariables>;
export const TemplateTripIdForRouteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TemplateTripIdForRoute"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"routeId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"templateTripIdForRoute"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"routeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"routeId"}}}]}]}}]} as unknown as DocumentNode<TemplateTripIdForRouteQuery, TemplateTripIdForRouteQueryVariables>;
export const TripByShareTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TripByShareToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shareToken"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripByShareToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shareToken"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shareToken"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"coverImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"waypoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"periodOfDay"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"anonId"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}}]}}]}}]} as unknown as DocumentNode<TripByShareTokenQuery, TripByShareTokenQueryVariables>;
export const TripBySlugDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TripBySlug"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"country"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"region"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripBySlug"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"country"},"value":{"kind":"Variable","name":{"kind":"Name","value":"country"}}},{"kind":"Argument","name":{"kind":"Name","value":"region"},"value":{"kind":"Variable","name":{"kind":"Name","value":"region"}}},{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"dayCount"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"coverImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"isTemplate"}},{"kind":"Field","name":{"kind":"Name","value":"polyline"}},{"kind":"Field","name":{"kind":"Name","value":"startLat"}},{"kind":"Field","name":{"kind":"Name","value":"startLng"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGainM"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedDurationMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"surfaceType"}},{"kind":"Field","name":{"kind":"Name","value":"curvatureIndex"}},{"kind":"Field","name":{"kind":"Name","value":"isFeatured"}},{"kind":"Field","name":{"kind":"Name","value":"isMotovaultPick"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"cloneCount"}},{"kind":"Field","name":{"kind":"Name","value":"averageRating"}},{"kind":"Field","name":{"kind":"Name","value":"reviewCount"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"isFlagged"}},{"kind":"Field","name":{"kind":"Name","value":"clonedFromTripId"}},{"kind":"Field","name":{"kind":"Name","value":"forkedFromTripId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"waypoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"tripId"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"periodOfDay"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]} as unknown as DocumentNode<TripBySlugQuery, TripBySlugQueryVariables>;
export const TripDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TripDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripDetail"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"datesPending"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"maxRiders"}},{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"coverImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"isTemplate"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"polyline"}},{"kind":"Field","name":{"kind":"Name","value":"startLat"}},{"kind":"Field","name":{"kind":"Name","value":"startLng"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGainM"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedDurationMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"surfaceType"}},{"kind":"Field","name":{"kind":"Name","value":"curvatureIndex"}},{"kind":"Field","name":{"kind":"Name","value":"dayCount"}},{"kind":"Field","name":{"kind":"Name","value":"isFeatured"}},{"kind":"Field","name":{"kind":"Name","value":"isMotovaultPick"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"cloneCount"}},{"kind":"Field","name":{"kind":"Name","value":"averageRating"}},{"kind":"Field","name":{"kind":"Name","value":"reviewCount"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"isFlagged"}},{"kind":"Field","name":{"kind":"Name","value":"isSaved"}},{"kind":"Field","name":{"kind":"Name","value":"clonedFromTripId"}},{"kind":"Field","name":{"kind":"Name","value":"forkedFromTripId"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"waypoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"tripId"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"periodOfDay"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"bikeId"}},{"kind":"Field","name":{"kind":"Name","value":"joinedAt"}}]}}]}}]}}]} as unknown as DocumentNode<TripDetailQuery, TripDetailQueryVariables>;
export const TripInvitesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TripInvites"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripInvites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"invitedUserId"}},{"kind":"Field","name":{"kind":"Name","value":"invitedAt"}},{"kind":"Field","name":{"kind":"Name","value":"acceptedAt"}},{"kind":"Field","name":{"kind":"Name","value":"declinedAt"}}]}}]}}]} as unknown as DocumentNode<TripInvitesQuery, TripInvitesQueryVariables>;
export const TripReviewsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TripReviews"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripReviews"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"conditionTags"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"tripId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"bikeId"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"bike"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"year"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]}}]}}]} as unknown as DocumentNode<TripReviewsQuery, TripReviewsQueryVariables>;
export const TripSuggestionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TripSuggestions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripSuggestions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"tripId"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"periodOfDay"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"decidedBy"}},{"kind":"Field","name":{"kind":"Name","value":"decidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"decidedNote"}},{"kind":"Field","name":{"kind":"Name","value":"waypointId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}}]}}]}}]}}]} as unknown as DocumentNode<TripSuggestionsQuery, TripSuggestionsQueryVariables>;
export const TripTemplatesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TripTemplates"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"TripTemplateFilterInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripTemplates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"dayCount"}},{"kind":"Field","name":{"kind":"Name","value":"startLat"}},{"kind":"Field","name":{"kind":"Name","value":"startLng"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGainM"}},{"kind":"Field","name":{"kind":"Name","value":"surfaceType"}},{"kind":"Field","name":{"kind":"Name","value":"polyline"}},{"kind":"Field","name":{"kind":"Name","value":"curvatureIndex"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedDurationMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"isFeatured"}},{"kind":"Field","name":{"kind":"Name","value":"isMotovaultPick"}},{"kind":"Field","name":{"kind":"Name","value":"coverImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"cloneCount"}},{"kind":"Field","name":{"kind":"Name","value":"averageRating"}},{"kind":"Field","name":{"kind":"Name","value":"reviewCount"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}}]} as unknown as DocumentNode<TripTemplatesQuery, TripTemplatesQueryVariables>;
export const ApproveMaintenanceDraftDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ApproveMaintenanceDraft"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ApproveMaintenanceDraftInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"approveMaintenanceDraft"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<ApproveMaintenanceDraftMutation, ApproveMaintenanceDraftMutationVariables>;
export const CreateBlogCategoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateBlogCategory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateBlogCategoryInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createBlogCategory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}}]}}]}}]} as unknown as DocumentNode<CreateBlogCategoryMutation, CreateBlogCategoryMutationVariables>;
export const CreateBlogKeywordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateBlogKeyword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateBlogKeywordInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createBlogKeyword"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<CreateBlogKeywordMutation, CreateBlogKeywordMutationVariables>;
export const CreateBlogPostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateBlogPost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateBlogPostInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createBlogPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BlogPostFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BlogPostFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BlogPost"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledFor"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"}},{"kind":"Field","name":{"kind":"Name","value":"coverAlt"}},{"kind":"Field","name":{"kind":"Name","value":"specData"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"typeData"}},{"kind":"Field","name":{"kind":"Name","value":"translations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"excerpt"}},{"kind":"Field","name":{"kind":"Name","value":"seoTitle"}},{"kind":"Field","name":{"kind":"Name","value":"seoDescription"}},{"kind":"Field","name":{"kind":"Name","value":"bodyRaw"}},{"kind":"Field","name":{"kind":"Name","value":"faq"}},{"kind":"Field","name":{"kind":"Name","value":"readingTime"}},{"kind":"Field","name":{"kind":"Name","value":"wordCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"keywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<CreateBlogPostMutation, CreateBlogPostMutationVariables>;
export const DeleteBlogPostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteBlogPost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteBlogPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteBlogPostMutation, DeleteBlogPostMutationVariables>;
export const JoinWaitlistDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinWaitlist"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinWaitlist"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}}]}]}}]} as unknown as DocumentNode<JoinWaitlistMutation, JoinWaitlistMutationVariables>;
export const PublishBlogPostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PublishBlogPost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publishBlogPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BlogPostFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BlogPostFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BlogPost"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledFor"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"}},{"kind":"Field","name":{"kind":"Name","value":"coverAlt"}},{"kind":"Field","name":{"kind":"Name","value":"specData"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"typeData"}},{"kind":"Field","name":{"kind":"Name","value":"translations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"excerpt"}},{"kind":"Field","name":{"kind":"Name","value":"seoTitle"}},{"kind":"Field","name":{"kind":"Name","value":"seoDescription"}},{"kind":"Field","name":{"kind":"Name","value":"bodyRaw"}},{"kind":"Field","name":{"kind":"Name","value":"faq"}},{"kind":"Field","name":{"kind":"Name","value":"readingTime"}},{"kind":"Field","name":{"kind":"Name","value":"wordCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"keywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<PublishBlogPostMutation, PublishBlogPostMutationVariables>;
export const RevertBlogPostVersionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RevertBlogPostVersion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"versionNum"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"revertBlogPostVersion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"versionNum"},"value":{"kind":"Variable","name":{"kind":"Name","value":"versionNum"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BlogPostFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BlogPostFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BlogPost"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledFor"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"}},{"kind":"Field","name":{"kind":"Name","value":"coverAlt"}},{"kind":"Field","name":{"kind":"Name","value":"specData"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"typeData"}},{"kind":"Field","name":{"kind":"Name","value":"translations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"excerpt"}},{"kind":"Field","name":{"kind":"Name","value":"seoTitle"}},{"kind":"Field","name":{"kind":"Name","value":"seoDescription"}},{"kind":"Field","name":{"kind":"Name","value":"bodyRaw"}},{"kind":"Field","name":{"kind":"Name","value":"faq"}},{"kind":"Field","name":{"kind":"Name","value":"readingTime"}},{"kind":"Field","name":{"kind":"Name","value":"wordCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"keywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<RevertBlogPostVersionMutation, RevertBlogPostVersionMutationVariables>;
export const ScheduleBlogPostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ScheduleBlogPost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ScheduleBlogPostInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"scheduleBlogPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BlogPostFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BlogPostFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BlogPost"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledFor"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"}},{"kind":"Field","name":{"kind":"Name","value":"coverAlt"}},{"kind":"Field","name":{"kind":"Name","value":"specData"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"typeData"}},{"kind":"Field","name":{"kind":"Name","value":"translations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"excerpt"}},{"kind":"Field","name":{"kind":"Name","value":"seoTitle"}},{"kind":"Field","name":{"kind":"Name","value":"seoDescription"}},{"kind":"Field","name":{"kind":"Name","value":"bodyRaw"}},{"kind":"Field","name":{"kind":"Name","value":"faq"}},{"kind":"Field","name":{"kind":"Name","value":"readingTime"}},{"kind":"Field","name":{"kind":"Name","value":"wordCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"keywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<ScheduleBlogPostMutation, ScheduleBlogPostMutationVariables>;
export const UnpublishBlogPostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnpublishBlogPost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unpublishBlogPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BlogPostFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BlogPostFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BlogPost"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledFor"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"}},{"kind":"Field","name":{"kind":"Name","value":"coverAlt"}},{"kind":"Field","name":{"kind":"Name","value":"specData"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"typeData"}},{"kind":"Field","name":{"kind":"Name","value":"translations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"excerpt"}},{"kind":"Field","name":{"kind":"Name","value":"seoTitle"}},{"kind":"Field","name":{"kind":"Name","value":"seoDescription"}},{"kind":"Field","name":{"kind":"Name","value":"bodyRaw"}},{"kind":"Field","name":{"kind":"Name","value":"faq"}},{"kind":"Field","name":{"kind":"Name","value":"readingTime"}},{"kind":"Field","name":{"kind":"Name","value":"wordCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"keywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<UnpublishBlogPostMutation, UnpublishBlogPostMutationVariables>;
export const UpdateBlogPostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateBlogPost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateBlogPostInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateBlogPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BlogPostFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BlogPostFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BlogPost"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledFor"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"}},{"kind":"Field","name":{"kind":"Name","value":"coverAlt"}},{"kind":"Field","name":{"kind":"Name","value":"specData"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"typeData"}},{"kind":"Field","name":{"kind":"Name","value":"translations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"excerpt"}},{"kind":"Field","name":{"kind":"Name","value":"seoTitle"}},{"kind":"Field","name":{"kind":"Name","value":"seoDescription"}},{"kind":"Field","name":{"kind":"Name","value":"bodyRaw"}},{"kind":"Field","name":{"kind":"Name","value":"faq"}},{"kind":"Field","name":{"kind":"Name","value":"readingTime"}},{"kind":"Field","name":{"kind":"Name","value":"wordCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"keywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<UpdateBlogPostMutation, UpdateBlogPostMutationVariables>;
export const AdminBlogPostVersionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AdminBlogPostVersions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminBlogPostVersions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"versionNum"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdBy"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<AdminBlogPostVersionsQuery, AdminBlogPostVersionsQueryVariables>;
export const AdminBlogPostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AdminBlogPost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminBlogPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BlogPostFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BlogPostFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BlogPost"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledFor"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"}},{"kind":"Field","name":{"kind":"Name","value":"coverAlt"}},{"kind":"Field","name":{"kind":"Name","value":"specData"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"typeData"}},{"kind":"Field","name":{"kind":"Name","value":"translations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"excerpt"}},{"kind":"Field","name":{"kind":"Name","value":"seoTitle"}},{"kind":"Field","name":{"kind":"Name","value":"seoDescription"}},{"kind":"Field","name":{"kind":"Name","value":"bodyRaw"}},{"kind":"Field","name":{"kind":"Name","value":"faq"}},{"kind":"Field","name":{"kind":"Name","value":"readingTime"}},{"kind":"Field","name":{"kind":"Name","value":"wordCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"keywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<AdminBlogPostQuery, AdminBlogPostQueryVariables>;
export const AdminBlogPostsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AdminBlogPosts"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ListBlogPostsInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminBlogPosts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BlogPostFields"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BlogPostFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BlogPost"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledFor"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"}},{"kind":"Field","name":{"kind":"Name","value":"coverAlt"}},{"kind":"Field","name":{"kind":"Name","value":"specData"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"typeData"}},{"kind":"Field","name":{"kind":"Name","value":"translations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"excerpt"}},{"kind":"Field","name":{"kind":"Name","value":"seoTitle"}},{"kind":"Field","name":{"kind":"Name","value":"seoDescription"}},{"kind":"Field","name":{"kind":"Name","value":"bodyRaw"}},{"kind":"Field","name":{"kind":"Name","value":"faq"}},{"kind":"Field","name":{"kind":"Name","value":"readingTime"}},{"kind":"Field","name":{"kind":"Name","value":"wordCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"keywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<AdminBlogPostsQuery, AdminBlogPostsQueryVariables>;
export const BlogTaxonomyDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BlogTaxonomy"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminBlogCategories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"adminBlogKeywords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<BlogTaxonomyQuery, BlogTaxonomyQueryVariables>;
export const BrowseCountriesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BrowseCountries"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"browseCountries"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BrowsePlaceFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BrowsePlaceFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BrowsePlace"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"routeCount"}}]}}]} as unknown as DocumentNode<BrowseCountriesQuery, BrowseCountriesQueryVariables>;
export const BrowseCountryBySlugDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BrowseCountryBySlug"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"browseCountryBySlug"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BrowsePlaceFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BrowsePlaceFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BrowsePlace"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"routeCount"}}]}}]} as unknown as DocumentNode<BrowseCountryBySlugQuery, BrowseCountryBySlugQueryVariables>;
export const BrowseRegionsByCountrySlugDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BrowseRegionsByCountrySlug"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"countrySlug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"browseRegionsByCountrySlug"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"countrySlug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"countrySlug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BrowsePlaceFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BrowsePlaceFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BrowsePlace"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"routeCount"}}]}}]} as unknown as DocumentNode<BrowseRegionsByCountrySlugQuery, BrowseRegionsByCountrySlugQueryVariables>;
export const BrowseExploreRegionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BrowseExploreRegion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"countrySlug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"regionSlug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"browseExploreRegion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"countrySlug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"countrySlug"}}},{"kind":"Argument","name":{"kind":"Name","value":"regionSlug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"regionSlug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"country"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BrowsePlaceFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"region"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BrowsePlaceFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BrowsePlaceFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BrowsePlace"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"parentId"}},{"kind":"Field","name":{"kind":"Name","value":"routeCount"}}]}}]} as unknown as DocumentNode<BrowseExploreRegionQuery, BrowseExploreRegionQueryVariables>;
export const GetGpxQuotaStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetGPXQuotaStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getGPXQuotaStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feature"}},{"kind":"Field","name":{"kind":"Name","value":"limit"}},{"kind":"Field","name":{"kind":"Name","value":"used"}},{"kind":"Field","name":{"kind":"Name","value":"remaining"}},{"kind":"Field","name":{"kind":"Name","value":"resetDate"}},{"kind":"Field","name":{"kind":"Name","value":"isExhausted"}}]}}]}}]} as unknown as DocumentNode<GetGpxQuotaStatusQuery, GetGpxQuotaStatusQueryVariables>;
export const MaintenanceDraftReviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MaintenanceDraftReview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maintenanceDraftReview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"schedules"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"variant"}},{"kind":"Field","name":{"kind":"Name","value":"taskName"}},{"kind":"Field","name":{"kind":"Name","value":"intervalKm"}},{"kind":"Field","name":{"kind":"Name","value":"intervalDays"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"sourcePage"}},{"kind":"Field","name":{"kind":"Name","value":"sourceContext"}},{"kind":"Field","name":{"kind":"Name","value":"sourceTitle"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"specs"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"variant"}},{"kind":"Field","name":{"kind":"Name","value":"specType"}},{"kind":"Field","name":{"kind":"Name","value":"specName"}},{"kind":"Field","name":{"kind":"Name","value":"valueNumeric"}},{"kind":"Field","name":{"kind":"Name","value":"valueDisplay"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"isSafetyCritical"}},{"kind":"Field","name":{"kind":"Name","value":"sourcePage"}},{"kind":"Field","name":{"kind":"Name","value":"sourceContext"}},{"kind":"Field","name":{"kind":"Name","value":"sourceTitle"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]} as unknown as DocumentNode<MaintenanceDraftReviewQuery, MaintenanceDraftReviewQueryVariables>;
export const PublicSavedTripsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PublicSavedTrips"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"handle"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publicSavedTrips"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"handle"},"value":{"kind":"Variable","name":{"kind":"Name","value":"handle"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGainM"}},{"kind":"Field","name":{"kind":"Name","value":"surfaceType"}},{"kind":"Field","name":{"kind":"Name","value":"isMotovaultPick"}},{"kind":"Field","name":{"kind":"Name","value":"averageRating"}},{"kind":"Field","name":{"kind":"Name","value":"reviewCount"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}}]} as unknown as DocumentNode<PublicSavedTripsQuery, PublicSavedTripsQueryVariables>;
export const SitemapPublishedTripsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SitemapPublishedTrips"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sitemapPublishedTrips"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<SitemapPublishedTripsQuery, SitemapPublishedTripsQueryVariables>;
export const WebTripBySlugDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WebTripBySlug"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"country"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"region"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripBySlug"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"country"},"value":{"kind":"Variable","name":{"kind":"Name","value":"country"}}},{"kind":"Argument","name":{"kind":"Name","value":"region"},"value":{"kind":"Variable","name":{"kind":"Name","value":"region"}}},{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"dayCount"}},{"kind":"Field","name":{"kind":"Name","value":"startLat"}},{"kind":"Field","name":{"kind":"Name","value":"startLng"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"distanceM"}},{"kind":"Field","name":{"kind":"Name","value":"elevationGainM"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedDurationMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"surfaceType"}},{"kind":"Field","name":{"kind":"Name","value":"isFeatured"}},{"kind":"Field","name":{"kind":"Name","value":"isMotovaultPick"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"polyline"}},{"kind":"Field","name":{"kind":"Name","value":"cloneCount"}},{"kind":"Field","name":{"kind":"Name","value":"averageRating"}},{"kind":"Field","name":{"kind":"Name","value":"reviewCount"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"organiser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}}]}},{"kind":"Field","name":{"kind":"Name","value":"waypoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"lng"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}}]}}]}}]}}]} as unknown as DocumentNode<WebTripBySlugQuery, WebTripBySlugQueryVariables>;
export const WebTripPathByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WebTripPathById"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripDetail"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tripId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tripId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"countryCode"}},{"kind":"Field","name":{"kind":"Name","value":"regionCode"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]} as unknown as DocumentNode<WebTripPathByIdQuery, WebTripPathByIdQueryVariables>;
export const WebTripReviewsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WebTripReviews"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"country"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"region"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tripReviews"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"country"},"value":{"kind":"Variable","name":{"kind":"Name","value":"country"}}},{"kind":"Argument","name":{"kind":"Name","value":"region"},"value":{"kind":"Variable","name":{"kind":"Name","value":"region"}}},{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"conditionTags"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"publicUsername"}},{"kind":"Field","name":{"kind":"Name","value":"avatarUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"bike"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"make"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"year"}}]}}]}}]}}]} as unknown as DocumentNode<WebTripReviewsQuery, WebTripReviewsQueryVariables>;