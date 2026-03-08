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
    "mutation CreateDiagnostic($input: CreateDiagnosticInput!) {\n  createDiagnostic(input: $input) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}": typeof types.CreateDiagnosticDocument,
    "mutation CreateFlag($input: CreateFlagInput!) {\n  createFlag(input: $input) {\n    id\n    articleId\n    userId\n    sectionReference\n    comment\n    status\n    createdAt\n  }\n}": typeof types.CreateFlagDocument,
    "mutation CreateMotorcycle($input: CreateMotorcycleInput!) {\n  createMotorcycle(input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n    isPrimary\n    createdAt\n  }\n}": typeof types.CreateMotorcycleDocument,
    "mutation CreateQuizAttempt($input: SubmitQuizInput!) {\n  submitQuiz(input: $input) {\n    id\n    quizId\n    score\n    totalQuestions\n    completedAt\n  }\n}": typeof types.CreateQuizAttemptDocument,
    "mutation DeleteMotorcycle($id: String!) {\n  deleteMotorcycle(id: $id)\n}": typeof types.DeleteMotorcycleDocument,
    "mutation MarkArticleRead($articleId: String!) {\n  markArticleRead(articleId: $articleId) {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}": typeof types.MarkArticleReadDocument,
    "mutation UpdateMotorcycle($id: String!, $input: UpdateMotorcycleInput!) {\n  updateMotorcycle(id: $id, input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n  }\n}": typeof types.UpdateMotorcycleDocument,
    "mutation UpdateUser($input: UpdateUserInput!) {\n  updateUser(input: $input) {\n    id\n    fullName\n    preferences\n  }\n}": typeof types.UpdateUserDocument,
    "query GetArticleBySlug($slug: String!) {\n  articleBySlug(slug: $slug) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    generatedAt\n    updatedAt\n  }\n}": typeof types.GetArticleBySlugDocument,
    "query GetQuizByArticle($articleId: String!) {\n  quizByArticle(articleId: $articleId) {\n    id\n    articleId\n    questions {\n      question\n      options\n      explanation\n    }\n    generatedAt\n  }\n}": typeof types.GetQuizByArticleDocument,
    "query Me {\n  me {\n    id\n    email\n    fullName\n    role\n    preferences\n    createdAt\n    updatedAt\n  }\n}": typeof types.MeDocument,
    "query MotorcycleMakes {\n  motorcycleMakes {\n    makeId\n    makeName\n    isPopular\n  }\n}": typeof types.MotorcycleMakesDocument,
    "query MotorcycleModels($makeId: Int!, $year: Int!) {\n  motorcycleModels(makeId: $makeId, year: $year) {\n    modelId\n    modelName\n  }\n}": typeof types.MotorcycleModelsDocument,
    "query MyDiagnostics {\n  myDiagnostics {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}": typeof types.MyDiagnosticsDocument,
    "query MyMotorcycles {\n  myMotorcycles {\n    id\n    userId\n    make\n    model\n    year\n    nickname\n    isPrimary\n    createdAt\n  }\n}": typeof types.MyMotorcyclesDocument,
    "query MyProgress {\n  myProgress {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}": typeof types.MyProgressDocument,
    "query SearchArticles($input: SearchArticlesInput!) {\n  searchArticles(input: $input) {\n    edges {\n      node {\n        id\n        slug\n        title\n        difficulty\n        category\n        viewCount\n        isSafetyCritical\n        generatedAt\n        updatedAt\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}": typeof types.SearchArticlesDocument,
};
const documents: Documents = {
    "mutation CreateDiagnostic($input: CreateDiagnosticInput!) {\n  createDiagnostic(input: $input) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}": types.CreateDiagnosticDocument,
    "mutation CreateFlag($input: CreateFlagInput!) {\n  createFlag(input: $input) {\n    id\n    articleId\n    userId\n    sectionReference\n    comment\n    status\n    createdAt\n  }\n}": types.CreateFlagDocument,
    "mutation CreateMotorcycle($input: CreateMotorcycleInput!) {\n  createMotorcycle(input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n    isPrimary\n    createdAt\n  }\n}": types.CreateMotorcycleDocument,
    "mutation CreateQuizAttempt($input: SubmitQuizInput!) {\n  submitQuiz(input: $input) {\n    id\n    quizId\n    score\n    totalQuestions\n    completedAt\n  }\n}": types.CreateQuizAttemptDocument,
    "mutation DeleteMotorcycle($id: String!) {\n  deleteMotorcycle(id: $id)\n}": types.DeleteMotorcycleDocument,
    "mutation MarkArticleRead($articleId: String!) {\n  markArticleRead(articleId: $articleId) {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}": types.MarkArticleReadDocument,
    "mutation UpdateMotorcycle($id: String!, $input: UpdateMotorcycleInput!) {\n  updateMotorcycle(id: $id, input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n  }\n}": types.UpdateMotorcycleDocument,
    "mutation UpdateUser($input: UpdateUserInput!) {\n  updateUser(input: $input) {\n    id\n    fullName\n    preferences\n  }\n}": types.UpdateUserDocument,
    "query GetArticleBySlug($slug: String!) {\n  articleBySlug(slug: $slug) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    generatedAt\n    updatedAt\n  }\n}": types.GetArticleBySlugDocument,
    "query GetQuizByArticle($articleId: String!) {\n  quizByArticle(articleId: $articleId) {\n    id\n    articleId\n    questions {\n      question\n      options\n      explanation\n    }\n    generatedAt\n  }\n}": types.GetQuizByArticleDocument,
    "query Me {\n  me {\n    id\n    email\n    fullName\n    role\n    preferences\n    createdAt\n    updatedAt\n  }\n}": types.MeDocument,
    "query MotorcycleMakes {\n  motorcycleMakes {\n    makeId\n    makeName\n    isPopular\n  }\n}": types.MotorcycleMakesDocument,
    "query MotorcycleModels($makeId: Int!, $year: Int!) {\n  motorcycleModels(makeId: $makeId, year: $year) {\n    modelId\n    modelName\n  }\n}": types.MotorcycleModelsDocument,
    "query MyDiagnostics {\n  myDiagnostics {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}": types.MyDiagnosticsDocument,
    "query MyMotorcycles {\n  myMotorcycles {\n    id\n    userId\n    make\n    model\n    year\n    nickname\n    isPrimary\n    createdAt\n  }\n}": types.MyMotorcyclesDocument,
    "query MyProgress {\n  myProgress {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}": types.MyProgressDocument,
    "query SearchArticles($input: SearchArticlesInput!) {\n  searchArticles(input: $input) {\n    edges {\n      node {\n        id\n        slug\n        title\n        difficulty\n        category\n        viewCount\n        isSafetyCritical\n        generatedAt\n        updatedAt\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}": types.SearchArticlesDocument,
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
export function graphql(source: "mutation CreateDiagnostic($input: CreateDiagnosticInput!) {\n  createDiagnostic(input: $input) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}"): (typeof documents)["mutation CreateDiagnostic($input: CreateDiagnosticInput!) {\n  createDiagnostic(input: $input) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateFlag($input: CreateFlagInput!) {\n  createFlag(input: $input) {\n    id\n    articleId\n    userId\n    sectionReference\n    comment\n    status\n    createdAt\n  }\n}"): (typeof documents)["mutation CreateFlag($input: CreateFlagInput!) {\n  createFlag(input: $input) {\n    id\n    articleId\n    userId\n    sectionReference\n    comment\n    status\n    createdAt\n  }\n}"];
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
export function graphql(source: "mutation DeleteMotorcycle($id: String!) {\n  deleteMotorcycle(id: $id)\n}"): (typeof documents)["mutation DeleteMotorcycle($id: String!) {\n  deleteMotorcycle(id: $id)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation MarkArticleRead($articleId: String!) {\n  markArticleRead(articleId: $articleId) {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}"): (typeof documents)["mutation MarkArticleRead($articleId: String!) {\n  markArticleRead(articleId: $articleId) {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateMotorcycle($id: String!, $input: UpdateMotorcycleInput!) {\n  updateMotorcycle(id: $id, input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n  }\n}"): (typeof documents)["mutation UpdateMotorcycle($id: String!, $input: UpdateMotorcycleInput!) {\n  updateMotorcycle(id: $id, input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateUser($input: UpdateUserInput!) {\n  updateUser(input: $input) {\n    id\n    fullName\n    preferences\n  }\n}"): (typeof documents)["mutation UpdateUser($input: UpdateUserInput!) {\n  updateUser(input: $input) {\n    id\n    fullName\n    preferences\n  }\n}"];
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
export function graphql(source: "query MyMotorcycles {\n  myMotorcycles {\n    id\n    userId\n    make\n    model\n    year\n    nickname\n    isPrimary\n    createdAt\n  }\n}"): (typeof documents)["query MyMotorcycles {\n  myMotorcycles {\n    id\n    userId\n    make\n    model\n    year\n    nickname\n    isPrimary\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MyProgress {\n  myProgress {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}"): (typeof documents)["query MyProgress {\n  myProgress {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query SearchArticles($input: SearchArticlesInput!) {\n  searchArticles(input: $input) {\n    edges {\n      node {\n        id\n        slug\n        title\n        difficulty\n        category\n        viewCount\n        isSafetyCritical\n        generatedAt\n        updatedAt\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}"): (typeof documents)["query SearchArticles($input: SearchArticlesInput!) {\n  searchArticles(input: $input) {\n    edges {\n      node {\n        id\n        slug\n        title\n        difficulty\n        category\n        viewCount\n        isSafetyCritical\n        generatedAt\n        updatedAt\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;