/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "mutation AddTaskPhoto($input: AddTaskPhotoInput!) {\n  addTaskPhoto(input: $input) {\n    id\n    taskId\n    storagePath\n    publicUrl\n    fileSizeBytes\n    mimeType\n    createdAt\n  }\n}": typeof types.AddTaskPhotoDocument,
    "mutation CompleteMaintenanceTask($id: String!, $input: CompleteMaintenanceTaskInput, $createNextOccurrence: Boolean) {\n  completeMaintenanceTask(\n    id: $id\n    input: $input\n    createNextOccurrence: $createNextOccurrence\n  ) {\n    completed {\n      id\n      status\n      completedAt\n      completedMileage\n      cost\n      partsCost\n      laborCost\n      currency\n    }\n    nextOccurrence {\n      id\n      title\n      description\n      dueDate\n      targetMileage\n      priority\n      status\n      isRecurring\n      intervalKm\n      intervalDays\n      source\n      motorcycleId\n      createdAt\n    }\n  }\n}": typeof types.CompleteMaintenanceTaskDocument,
    "mutation CompleteOnboarding($input: CompleteOnboardingInput!) {\n  completeOnboarding(input: $input) {\n    id\n    preferences\n    createdAt\n    updatedAt\n  }\n}": typeof types.CompleteOnboardingDocument,
    "mutation CreateDiagnostic($input: CreateDiagnosticInput!) {\n  createDiagnostic(input: $input) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}": typeof types.CreateDiagnosticDocument,
    "mutation CreateFlag($input: CreateFlagInput!) {\n  createFlag(input: $input) {\n    id\n    articleId\n    userId\n    sectionReference\n    comment\n    status\n    createdAt\n  }\n}": typeof types.CreateFlagDocument,
    "mutation CreateMaintenanceTask($input: CreateMaintenanceTaskInput!) {\n  createMaintenanceTask(input: $input) {\n    id\n    title\n    priority\n    status\n    dueDate\n    targetMileage\n    createdAt\n  }\n}": typeof types.CreateMaintenanceTaskDocument,
    "mutation CreateMotorcycle($input: CreateMotorcycleInput!) {\n  createMotorcycle(input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n    isPrimary\n    createdAt\n  }\n}": typeof types.CreateMotorcycleDocument,
    "mutation CreateQuizAttempt($input: SubmitQuizInput!) {\n  submitQuiz(input: $input) {\n    id\n    quizId\n    score\n    totalQuestions\n    completedAt\n  }\n}": typeof types.CreateQuizAttemptDocument,
    "mutation CreateShareLink($input: CreateShareLinkInput!) {\n  createShareLink(input: $input) {\n    id\n    token\n    motorcycleId\n    expiresAt\n    createdAt\n    url\n  }\n}": typeof types.CreateShareLinkDocument,
    "mutation DeleteMaintenanceTask($id: String!) {\n  deleteMaintenanceTask(id: $id)\n}": typeof types.DeleteMaintenanceTaskDocument,
    "mutation DeleteMotorcycle($id: String!) {\n  deleteMotorcycle(id: $id)\n}": typeof types.DeleteMotorcycleDocument,
    "mutation DeleteTaskPhoto($photoId: ID!) {\n  deleteTaskPhoto(photoId: $photoId)\n}": typeof types.DeleteTaskPhotoDocument,
    "mutation GenerateArticle($input: GenerateArticleInput!) {\n  generateArticle(input: $input) {\n    id\n    slug\n    title\n    difficulty\n    category\n    contentJson\n    readTime\n    generatedAt\n  }\n}": typeof types.GenerateArticleDocument,
    "mutation GenerateOnboardingInsights($input: GenerateInsightsInput!) {\n  generateOnboardingInsights(input: $input) {\n    icon\n    title\n    body\n    type\n  }\n}": typeof types.GenerateOnboardingInsightsDocument,
    "mutation MarkArticleRead($articleId: String!) {\n  markArticleRead(articleId: $articleId) {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}": typeof types.MarkArticleReadDocument,
    "mutation RevokeShareLink($linkId: ID!) {\n  revokeShareLink(linkId: $linkId)\n}": typeof types.RevokeShareLinkDocument,
    "mutation SubmitDiagnostic($input: SubmitDiagnosticInput!) {\n  submitDiagnostic(input: $input) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    resultJson\n    description\n    status\n    createdAt\n  }\n}": typeof types.SubmitDiagnosticDocument,
    "mutation UpdateMotorcycle($id: String!, $input: UpdateMotorcycleInput!) {\n  updateMotorcycle(id: $id, input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n    isPrimary\n    primaryPhotoUrl\n    currentMileage\n    mileageUnit\n    mileageUpdatedAt\n  }\n}": typeof types.UpdateMotorcycleDocument,
    "mutation UpdateUser($input: UpdateUserInput!) {\n  updateUser(input: $input) {\n    id\n    fullName\n    preferences\n  }\n}": typeof types.UpdateUserDocument,
    "query AllMaintenanceTasks {\n  allMaintenanceTasks {\n    id\n    motorcycleId\n    title\n    dueDate\n    targetMileage\n    priority\n    status\n    completedAt\n  }\n}": typeof types.AllMaintenanceTasksDocument,
    "query ArticleBySlugFull($slug: String!) {\n  articleBySlugFull(slug: $slug) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    contentJson\n    readTime\n    generatedAt\n    updatedAt\n  }\n}": typeof types.ArticleBySlugFullDocument,
    "query DiagnosticById($id: String!) {\n  diagnosticById(id: $id) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    resultJson\n    description\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}": typeof types.DiagnosticByIdDocument,
    "query GetArticleBySlug($slug: String!) {\n  articleBySlug(slug: $slug) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    generatedAt\n    updatedAt\n  }\n}": typeof types.GetArticleBySlugDocument,
    "query GetQuizByArticle($articleId: String!) {\n  quizByArticle(articleId: $articleId) {\n    id\n    articleId\n    questions {\n      question\n      options\n      explanation\n    }\n    generatedAt\n  }\n}": typeof types.GetQuizByArticleDocument,
    "query MaintenanceTaskHistory($motorcycleId: String!, $limit: Int) {\n  maintenanceTaskHistory(motorcycleId: $motorcycleId, limit: $limit) {\n    id\n    userId\n    motorcycleId\n    title\n    description\n    dueDate\n    targetMileage\n    priority\n    status\n    notes\n    partsNeeded\n    completedAt\n    completedMileage\n    source\n    oemScheduleId\n    intervalKm\n    intervalDays\n    isRecurring\n    createdAt\n    updatedAt\n  }\n}": typeof types.MaintenanceTaskHistoryDocument,
    "query MaintenanceTasksByMotorcycle($motorcycleId: String!) {\n  maintenanceTasks(motorcycleId: $motorcycleId) {\n    id\n    userId\n    motorcycleId\n    title\n    description\n    dueDate\n    targetMileage\n    priority\n    status\n    notes\n    partsNeeded\n    completedAt\n    completedMileage\n    cost\n    partsCost\n    laborCost\n    currency\n    source\n    isRecurring\n    photos {\n      id\n      storagePath\n      publicUrl\n    }\n    createdAt\n    updatedAt\n  }\n}": typeof types.MaintenanceTasksByMotorcycleDocument,
    "query Me {\n  me {\n    id\n    email\n    fullName\n    role\n    preferences\n    createdAt\n    updatedAt\n  }\n}": typeof types.MeDocument,
    "query MotorcycleMakes {\n  motorcycleMakes {\n    makeId\n    makeName\n    isPopular\n  }\n}": typeof types.MotorcycleMakesDocument,
    "query MotorcycleModels($makeId: Int!, $year: Int!) {\n  motorcycleModels(makeId: $makeId, year: $year) {\n    modelId\n    modelName\n  }\n}": typeof types.MotorcycleModelsDocument,
    "query MyDiagnostics {\n  myDiagnostics {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}": typeof types.MyDiagnosticsDocument,
    "query MyMotorcycles {\n  myMotorcycles {\n    id\n    userId\n    make\n    model\n    year\n    nickname\n    isPrimary\n    primaryPhotoUrl\n    currentMileage\n    mileageUnit\n    mileageUpdatedAt\n    createdAt\n  }\n}": typeof types.MyMotorcyclesDocument,
    "query MyProgress {\n  myProgress {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}": typeof types.MyProgressDocument,
    "query MyShareLinks($motorcycleId: ID!) {\n  myShareLinks(motorcycleId: $motorcycleId) {\n    id\n    token\n    motorcycleId\n    expiresAt\n    createdAt\n    url\n  }\n}": typeof types.MyShareLinksDocument,
    "query SearchArticles($input: SearchArticlesInput!) {\n  searchArticles(input: $input) {\n    edges {\n      node {\n        id\n        slug\n        title\n        difficulty\n        category\n        viewCount\n        isSafetyCritical\n        generatedAt\n        updatedAt\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}": typeof types.SearchArticlesDocument,
    "query SpendingSummary($motorcycleId: String!) {\n  spendingSummary(motorcycleId: $motorcycleId) {\n    thisYear\n    allTime\n  }\n}": typeof types.SpendingSummaryDocument,
};
const documents: Documents = {
    "mutation AddTaskPhoto($input: AddTaskPhotoInput!) {\n  addTaskPhoto(input: $input) {\n    id\n    taskId\n    storagePath\n    publicUrl\n    fileSizeBytes\n    mimeType\n    createdAt\n  }\n}": types.AddTaskPhotoDocument,
    "mutation CompleteMaintenanceTask($id: String!, $input: CompleteMaintenanceTaskInput, $createNextOccurrence: Boolean) {\n  completeMaintenanceTask(\n    id: $id\n    input: $input\n    createNextOccurrence: $createNextOccurrence\n  ) {\n    completed {\n      id\n      status\n      completedAt\n      completedMileage\n      cost\n      partsCost\n      laborCost\n      currency\n    }\n    nextOccurrence {\n      id\n      title\n      description\n      dueDate\n      targetMileage\n      priority\n      status\n      isRecurring\n      intervalKm\n      intervalDays\n      source\n      motorcycleId\n      createdAt\n    }\n  }\n}": types.CompleteMaintenanceTaskDocument,
    "mutation CompleteOnboarding($input: CompleteOnboardingInput!) {\n  completeOnboarding(input: $input) {\n    id\n    preferences\n    createdAt\n    updatedAt\n  }\n}": types.CompleteOnboardingDocument,
    "mutation CreateDiagnostic($input: CreateDiagnosticInput!) {\n  createDiagnostic(input: $input) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}": types.CreateDiagnosticDocument,
    "mutation CreateFlag($input: CreateFlagInput!) {\n  createFlag(input: $input) {\n    id\n    articleId\n    userId\n    sectionReference\n    comment\n    status\n    createdAt\n  }\n}": types.CreateFlagDocument,
    "mutation CreateMaintenanceTask($input: CreateMaintenanceTaskInput!) {\n  createMaintenanceTask(input: $input) {\n    id\n    title\n    priority\n    status\n    dueDate\n    targetMileage\n    createdAt\n  }\n}": types.CreateMaintenanceTaskDocument,
    "mutation CreateMotorcycle($input: CreateMotorcycleInput!) {\n  createMotorcycle(input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n    isPrimary\n    createdAt\n  }\n}": types.CreateMotorcycleDocument,
    "mutation CreateQuizAttempt($input: SubmitQuizInput!) {\n  submitQuiz(input: $input) {\n    id\n    quizId\n    score\n    totalQuestions\n    completedAt\n  }\n}": types.CreateQuizAttemptDocument,
    "mutation CreateShareLink($input: CreateShareLinkInput!) {\n  createShareLink(input: $input) {\n    id\n    token\n    motorcycleId\n    expiresAt\n    createdAt\n    url\n  }\n}": types.CreateShareLinkDocument,
    "mutation DeleteMaintenanceTask($id: String!) {\n  deleteMaintenanceTask(id: $id)\n}": types.DeleteMaintenanceTaskDocument,
    "mutation DeleteMotorcycle($id: String!) {\n  deleteMotorcycle(id: $id)\n}": types.DeleteMotorcycleDocument,
    "mutation DeleteTaskPhoto($photoId: ID!) {\n  deleteTaskPhoto(photoId: $photoId)\n}": types.DeleteTaskPhotoDocument,
    "mutation GenerateArticle($input: GenerateArticleInput!) {\n  generateArticle(input: $input) {\n    id\n    slug\n    title\n    difficulty\n    category\n    contentJson\n    readTime\n    generatedAt\n  }\n}": types.GenerateArticleDocument,
    "mutation GenerateOnboardingInsights($input: GenerateInsightsInput!) {\n  generateOnboardingInsights(input: $input) {\n    icon\n    title\n    body\n    type\n  }\n}": types.GenerateOnboardingInsightsDocument,
    "mutation MarkArticleRead($articleId: String!) {\n  markArticleRead(articleId: $articleId) {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}": types.MarkArticleReadDocument,
    "mutation RevokeShareLink($linkId: ID!) {\n  revokeShareLink(linkId: $linkId)\n}": types.RevokeShareLinkDocument,
    "mutation SubmitDiagnostic($input: SubmitDiagnosticInput!) {\n  submitDiagnostic(input: $input) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    resultJson\n    description\n    status\n    createdAt\n  }\n}": types.SubmitDiagnosticDocument,
    "mutation UpdateMotorcycle($id: String!, $input: UpdateMotorcycleInput!) {\n  updateMotorcycle(id: $id, input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n    isPrimary\n    primaryPhotoUrl\n    currentMileage\n    mileageUnit\n    mileageUpdatedAt\n  }\n}": types.UpdateMotorcycleDocument,
    "mutation UpdateUser($input: UpdateUserInput!) {\n  updateUser(input: $input) {\n    id\n    fullName\n    preferences\n  }\n}": types.UpdateUserDocument,
    "query AllMaintenanceTasks {\n  allMaintenanceTasks {\n    id\n    motorcycleId\n    title\n    dueDate\n    targetMileage\n    priority\n    status\n    completedAt\n  }\n}": types.AllMaintenanceTasksDocument,
    "query ArticleBySlugFull($slug: String!) {\n  articleBySlugFull(slug: $slug) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    contentJson\n    readTime\n    generatedAt\n    updatedAt\n  }\n}": types.ArticleBySlugFullDocument,
    "query DiagnosticById($id: String!) {\n  diagnosticById(id: $id) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    resultJson\n    description\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}": types.DiagnosticByIdDocument,
    "query GetArticleBySlug($slug: String!) {\n  articleBySlug(slug: $slug) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    generatedAt\n    updatedAt\n  }\n}": types.GetArticleBySlugDocument,
    "query GetQuizByArticle($articleId: String!) {\n  quizByArticle(articleId: $articleId) {\n    id\n    articleId\n    questions {\n      question\n      options\n      explanation\n    }\n    generatedAt\n  }\n}": types.GetQuizByArticleDocument,
    "query MaintenanceTaskHistory($motorcycleId: String!, $limit: Int) {\n  maintenanceTaskHistory(motorcycleId: $motorcycleId, limit: $limit) {\n    id\n    userId\n    motorcycleId\n    title\n    description\n    dueDate\n    targetMileage\n    priority\n    status\n    notes\n    partsNeeded\n    completedAt\n    completedMileage\n    source\n    oemScheduleId\n    intervalKm\n    intervalDays\n    isRecurring\n    createdAt\n    updatedAt\n  }\n}": types.MaintenanceTaskHistoryDocument,
    "query MaintenanceTasksByMotorcycle($motorcycleId: String!) {\n  maintenanceTasks(motorcycleId: $motorcycleId) {\n    id\n    userId\n    motorcycleId\n    title\n    description\n    dueDate\n    targetMileage\n    priority\n    status\n    notes\n    partsNeeded\n    completedAt\n    completedMileage\n    cost\n    partsCost\n    laborCost\n    currency\n    source\n    isRecurring\n    photos {\n      id\n      storagePath\n      publicUrl\n    }\n    createdAt\n    updatedAt\n  }\n}": types.MaintenanceTasksByMotorcycleDocument,
    "query Me {\n  me {\n    id\n    email\n    fullName\n    role\n    preferences\n    createdAt\n    updatedAt\n  }\n}": types.MeDocument,
    "query MotorcycleMakes {\n  motorcycleMakes {\n    makeId\n    makeName\n    isPopular\n  }\n}": types.MotorcycleMakesDocument,
    "query MotorcycleModels($makeId: Int!, $year: Int!) {\n  motorcycleModels(makeId: $makeId, year: $year) {\n    modelId\n    modelName\n  }\n}": types.MotorcycleModelsDocument,
    "query MyDiagnostics {\n  myDiagnostics {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}": types.MyDiagnosticsDocument,
    "query MyMotorcycles {\n  myMotorcycles {\n    id\n    userId\n    make\n    model\n    year\n    nickname\n    isPrimary\n    primaryPhotoUrl\n    currentMileage\n    mileageUnit\n    mileageUpdatedAt\n    createdAt\n  }\n}": types.MyMotorcyclesDocument,
    "query MyProgress {\n  myProgress {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}": types.MyProgressDocument,
    "query MyShareLinks($motorcycleId: ID!) {\n  myShareLinks(motorcycleId: $motorcycleId) {\n    id\n    token\n    motorcycleId\n    expiresAt\n    createdAt\n    url\n  }\n}": types.MyShareLinksDocument,
    "query SearchArticles($input: SearchArticlesInput!) {\n  searchArticles(input: $input) {\n    edges {\n      node {\n        id\n        slug\n        title\n        difficulty\n        category\n        viewCount\n        isSafetyCritical\n        generatedAt\n        updatedAt\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}": types.SearchArticlesDocument,
    "query SpendingSummary($motorcycleId: String!) {\n  spendingSummary(motorcycleId: $motorcycleId) {\n    thisYear\n    allTime\n  }\n}": types.SpendingSummaryDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation AddTaskPhoto($input: AddTaskPhotoInput!) {\n  addTaskPhoto(input: $input) {\n    id\n    taskId\n    storagePath\n    publicUrl\n    fileSizeBytes\n    mimeType\n    createdAt\n  }\n}"): (typeof documents)["mutation AddTaskPhoto($input: AddTaskPhotoInput!) {\n  addTaskPhoto(input: $input) {\n    id\n    taskId\n    storagePath\n    publicUrl\n    fileSizeBytes\n    mimeType\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CompleteMaintenanceTask($id: String!, $input: CompleteMaintenanceTaskInput, $createNextOccurrence: Boolean) {\n  completeMaintenanceTask(\n    id: $id\n    input: $input\n    createNextOccurrence: $createNextOccurrence\n  ) {\n    completed {\n      id\n      status\n      completedAt\n      completedMileage\n      cost\n      partsCost\n      laborCost\n      currency\n    }\n    nextOccurrence {\n      id\n      title\n      description\n      dueDate\n      targetMileage\n      priority\n      status\n      isRecurring\n      intervalKm\n      intervalDays\n      source\n      motorcycleId\n      createdAt\n    }\n  }\n}"): (typeof documents)["mutation CompleteMaintenanceTask($id: String!, $input: CompleteMaintenanceTaskInput, $createNextOccurrence: Boolean) {\n  completeMaintenanceTask(\n    id: $id\n    input: $input\n    createNextOccurrence: $createNextOccurrence\n  ) {\n    completed {\n      id\n      status\n      completedAt\n      completedMileage\n      cost\n      partsCost\n      laborCost\n      currency\n    }\n    nextOccurrence {\n      id\n      title\n      description\n      dueDate\n      targetMileage\n      priority\n      status\n      isRecurring\n      intervalKm\n      intervalDays\n      source\n      motorcycleId\n      createdAt\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CompleteOnboarding($input: CompleteOnboardingInput!) {\n  completeOnboarding(input: $input) {\n    id\n    preferences\n    createdAt\n    updatedAt\n  }\n}"): (typeof documents)["mutation CompleteOnboarding($input: CompleteOnboardingInput!) {\n  completeOnboarding(input: $input) {\n    id\n    preferences\n    createdAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateDiagnostic($input: CreateDiagnosticInput!) {\n  createDiagnostic(input: $input) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}"): (typeof documents)["mutation CreateDiagnostic($input: CreateDiagnosticInput!) {\n  createDiagnostic(input: $input) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateFlag($input: CreateFlagInput!) {\n  createFlag(input: $input) {\n    id\n    articleId\n    userId\n    sectionReference\n    comment\n    status\n    createdAt\n  }\n}"): (typeof documents)["mutation CreateFlag($input: CreateFlagInput!) {\n  createFlag(input: $input) {\n    id\n    articleId\n    userId\n    sectionReference\n    comment\n    status\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateMaintenanceTask($input: CreateMaintenanceTaskInput!) {\n  createMaintenanceTask(input: $input) {\n    id\n    title\n    priority\n    status\n    dueDate\n    targetMileage\n    createdAt\n  }\n}"): (typeof documents)["mutation CreateMaintenanceTask($input: CreateMaintenanceTaskInput!) {\n  createMaintenanceTask(input: $input) {\n    id\n    title\n    priority\n    status\n    dueDate\n    targetMileage\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateMotorcycle($input: CreateMotorcycleInput!) {\n  createMotorcycle(input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n    isPrimary\n    createdAt\n  }\n}"): (typeof documents)["mutation CreateMotorcycle($input: CreateMotorcycleInput!) {\n  createMotorcycle(input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n    isPrimary\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateQuizAttempt($input: SubmitQuizInput!) {\n  submitQuiz(input: $input) {\n    id\n    quizId\n    score\n    totalQuestions\n    completedAt\n  }\n}"): (typeof documents)["mutation CreateQuizAttempt($input: SubmitQuizInput!) {\n  submitQuiz(input: $input) {\n    id\n    quizId\n    score\n    totalQuestions\n    completedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateShareLink($input: CreateShareLinkInput!) {\n  createShareLink(input: $input) {\n    id\n    token\n    motorcycleId\n    expiresAt\n    createdAt\n    url\n  }\n}"): (typeof documents)["mutation CreateShareLink($input: CreateShareLinkInput!) {\n  createShareLink(input: $input) {\n    id\n    token\n    motorcycleId\n    expiresAt\n    createdAt\n    url\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation DeleteMaintenanceTask($id: String!) {\n  deleteMaintenanceTask(id: $id)\n}"): (typeof documents)["mutation DeleteMaintenanceTask($id: String!) {\n  deleteMaintenanceTask(id: $id)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation DeleteMotorcycle($id: String!) {\n  deleteMotorcycle(id: $id)\n}"): (typeof documents)["mutation DeleteMotorcycle($id: String!) {\n  deleteMotorcycle(id: $id)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation DeleteTaskPhoto($photoId: ID!) {\n  deleteTaskPhoto(photoId: $photoId)\n}"): (typeof documents)["mutation DeleteTaskPhoto($photoId: ID!) {\n  deleteTaskPhoto(photoId: $photoId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation GenerateArticle($input: GenerateArticleInput!) {\n  generateArticle(input: $input) {\n    id\n    slug\n    title\n    difficulty\n    category\n    contentJson\n    readTime\n    generatedAt\n  }\n}"): (typeof documents)["mutation GenerateArticle($input: GenerateArticleInput!) {\n  generateArticle(input: $input) {\n    id\n    slug\n    title\n    difficulty\n    category\n    contentJson\n    readTime\n    generatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation GenerateOnboardingInsights($input: GenerateInsightsInput!) {\n  generateOnboardingInsights(input: $input) {\n    icon\n    title\n    body\n    type\n  }\n}"): (typeof documents)["mutation GenerateOnboardingInsights($input: GenerateInsightsInput!) {\n  generateOnboardingInsights(input: $input) {\n    icon\n    title\n    body\n    type\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation MarkArticleRead($articleId: String!) {\n  markArticleRead(articleId: $articleId) {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}"): (typeof documents)["mutation MarkArticleRead($articleId: String!) {\n  markArticleRead(articleId: $articleId) {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation RevokeShareLink($linkId: ID!) {\n  revokeShareLink(linkId: $linkId)\n}"): (typeof documents)["mutation RevokeShareLink($linkId: ID!) {\n  revokeShareLink(linkId: $linkId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation SubmitDiagnostic($input: SubmitDiagnosticInput!) {\n  submitDiagnostic(input: $input) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    resultJson\n    description\n    status\n    createdAt\n  }\n}"): (typeof documents)["mutation SubmitDiagnostic($input: SubmitDiagnosticInput!) {\n  submitDiagnostic(input: $input) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    resultJson\n    description\n    status\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateMotorcycle($id: String!, $input: UpdateMotorcycleInput!) {\n  updateMotorcycle(id: $id, input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n    isPrimary\n    primaryPhotoUrl\n    currentMileage\n    mileageUnit\n    mileageUpdatedAt\n  }\n}"): (typeof documents)["mutation UpdateMotorcycle($id: String!, $input: UpdateMotorcycleInput!) {\n  updateMotorcycle(id: $id, input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n    isPrimary\n    primaryPhotoUrl\n    currentMileage\n    mileageUnit\n    mileageUpdatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateUser($input: UpdateUserInput!) {\n  updateUser(input: $input) {\n    id\n    fullName\n    preferences\n  }\n}"): (typeof documents)["mutation UpdateUser($input: UpdateUserInput!) {\n  updateUser(input: $input) {\n    id\n    fullName\n    preferences\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query AllMaintenanceTasks {\n  allMaintenanceTasks {\n    id\n    motorcycleId\n    title\n    dueDate\n    targetMileage\n    priority\n    status\n    completedAt\n  }\n}"): (typeof documents)["query AllMaintenanceTasks {\n  allMaintenanceTasks {\n    id\n    motorcycleId\n    title\n    dueDate\n    targetMileage\n    priority\n    status\n    completedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query ArticleBySlugFull($slug: String!) {\n  articleBySlugFull(slug: $slug) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    contentJson\n    readTime\n    generatedAt\n    updatedAt\n  }\n}"): (typeof documents)["query ArticleBySlugFull($slug: String!) {\n  articleBySlugFull(slug: $slug) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    contentJson\n    readTime\n    generatedAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query DiagnosticById($id: String!) {\n  diagnosticById(id: $id) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    resultJson\n    description\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}"): (typeof documents)["query DiagnosticById($id: String!) {\n  diagnosticById(id: $id) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    resultJson\n    description\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetArticleBySlug($slug: String!) {\n  articleBySlug(slug: $slug) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    generatedAt\n    updatedAt\n  }\n}"): (typeof documents)["query GetArticleBySlug($slug: String!) {\n  articleBySlug(slug: $slug) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    generatedAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetQuizByArticle($articleId: String!) {\n  quizByArticle(articleId: $articleId) {\n    id\n    articleId\n    questions {\n      question\n      options\n      explanation\n    }\n    generatedAt\n  }\n}"): (typeof documents)["query GetQuizByArticle($articleId: String!) {\n  quizByArticle(articleId: $articleId) {\n    id\n    articleId\n    questions {\n      question\n      options\n      explanation\n    }\n    generatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MaintenanceTaskHistory($motorcycleId: String!, $limit: Int) {\n  maintenanceTaskHistory(motorcycleId: $motorcycleId, limit: $limit) {\n    id\n    userId\n    motorcycleId\n    title\n    description\n    dueDate\n    targetMileage\n    priority\n    status\n    notes\n    partsNeeded\n    completedAt\n    completedMileage\n    source\n    oemScheduleId\n    intervalKm\n    intervalDays\n    isRecurring\n    createdAt\n    updatedAt\n  }\n}"): (typeof documents)["query MaintenanceTaskHistory($motorcycleId: String!, $limit: Int) {\n  maintenanceTaskHistory(motorcycleId: $motorcycleId, limit: $limit) {\n    id\n    userId\n    motorcycleId\n    title\n    description\n    dueDate\n    targetMileage\n    priority\n    status\n    notes\n    partsNeeded\n    completedAt\n    completedMileage\n    source\n    oemScheduleId\n    intervalKm\n    intervalDays\n    isRecurring\n    createdAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MaintenanceTasksByMotorcycle($motorcycleId: String!) {\n  maintenanceTasks(motorcycleId: $motorcycleId) {\n    id\n    userId\n    motorcycleId\n    title\n    description\n    dueDate\n    targetMileage\n    priority\n    status\n    notes\n    partsNeeded\n    completedAt\n    completedMileage\n    cost\n    partsCost\n    laborCost\n    currency\n    source\n    isRecurring\n    photos {\n      id\n      storagePath\n      publicUrl\n    }\n    createdAt\n    updatedAt\n  }\n}"): (typeof documents)["query MaintenanceTasksByMotorcycle($motorcycleId: String!) {\n  maintenanceTasks(motorcycleId: $motorcycleId) {\n    id\n    userId\n    motorcycleId\n    title\n    description\n    dueDate\n    targetMileage\n    priority\n    status\n    notes\n    partsNeeded\n    completedAt\n    completedMileage\n    cost\n    partsCost\n    laborCost\n    currency\n    source\n    isRecurring\n    photos {\n      id\n      storagePath\n      publicUrl\n    }\n    createdAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query Me {\n  me {\n    id\n    email\n    fullName\n    role\n    preferences\n    createdAt\n    updatedAt\n  }\n}"): (typeof documents)["query Me {\n  me {\n    id\n    email\n    fullName\n    role\n    preferences\n    createdAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MotorcycleMakes {\n  motorcycleMakes {\n    makeId\n    makeName\n    isPopular\n  }\n}"): (typeof documents)["query MotorcycleMakes {\n  motorcycleMakes {\n    makeId\n    makeName\n    isPopular\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MotorcycleModels($makeId: Int!, $year: Int!) {\n  motorcycleModels(makeId: $makeId, year: $year) {\n    modelId\n    modelName\n  }\n}"): (typeof documents)["query MotorcycleModels($makeId: Int!, $year: Int!) {\n  motorcycleModels(makeId: $makeId, year: $year) {\n    modelId\n    modelName\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MyDiagnostics {\n  myDiagnostics {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}"): (typeof documents)["query MyDiagnostics {\n  myDiagnostics {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MyMotorcycles {\n  myMotorcycles {\n    id\n    userId\n    make\n    model\n    year\n    nickname\n    isPrimary\n    primaryPhotoUrl\n    currentMileage\n    mileageUnit\n    mileageUpdatedAt\n    createdAt\n  }\n}"): (typeof documents)["query MyMotorcycles {\n  myMotorcycles {\n    id\n    userId\n    make\n    model\n    year\n    nickname\n    isPrimary\n    primaryPhotoUrl\n    currentMileage\n    mileageUnit\n    mileageUpdatedAt\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MyProgress {\n  myProgress {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}"): (typeof documents)["query MyProgress {\n  myProgress {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MyShareLinks($motorcycleId: ID!) {\n  myShareLinks(motorcycleId: $motorcycleId) {\n    id\n    token\n    motorcycleId\n    expiresAt\n    createdAt\n    url\n  }\n}"): (typeof documents)["query MyShareLinks($motorcycleId: ID!) {\n  myShareLinks(motorcycleId: $motorcycleId) {\n    id\n    token\n    motorcycleId\n    expiresAt\n    createdAt\n    url\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query SearchArticles($input: SearchArticlesInput!) {\n  searchArticles(input: $input) {\n    edges {\n      node {\n        id\n        slug\n        title\n        difficulty\n        category\n        viewCount\n        isSafetyCritical\n        generatedAt\n        updatedAt\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}"): (typeof documents)["query SearchArticles($input: SearchArticlesInput!) {\n  searchArticles(input: $input) {\n    edges {\n      node {\n        id\n        slug\n        title\n        difficulty\n        category\n        viewCount\n        isSafetyCritical\n        generatedAt\n        updatedAt\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query SpendingSummary($motorcycleId: String!) {\n  spendingSummary(motorcycleId: $motorcycleId) {\n    thisYear\n    allTime\n  }\n}"): (typeof documents)["query SpendingSummary($motorcycleId: String!) {\n  spendingSummary(motorcycleId: $motorcycleId) {\n    thisYear\n    allTime\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;