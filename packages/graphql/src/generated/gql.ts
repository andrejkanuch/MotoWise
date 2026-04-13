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
    "mutation AddExpensePhoto($input: AddExpensePhotoInput!) {\n  addExpensePhoto(input: $input) {\n    id\n    expenseId\n    storagePath\n    publicUrl\n    fileSizeBytes\n    mimeType\n    createdAt\n  }\n}": typeof types.AddExpensePhotoDocument,
    "mutation AddTaskPhoto($input: AddTaskPhotoInput!) {\n  addTaskPhoto(input: $input) {\n    id\n    taskId\n    storagePath\n    publicUrl\n    fileSizeBytes\n    mimeType\n    createdAt\n  }\n}": typeof types.AddTaskPhotoDocument,
    "mutation AddWaypoint($input: CreateWaypointInput!) {\n  addWaypoint(input: $input) {\n    id\n    tripId\n    sortOrder\n    dayIndex\n    type\n    name\n    notes\n    lat\n    lng\n    createdAt\n  }\n}": typeof types.AddWaypointDocument,
    "mutation CancelGroupRide($groupRideId: ID!) {\n  cancelGroupRide(groupRideId: $groupRideId)\n}": typeof types.CancelGroupRideDocument,
    "mutation CompleteMaintenanceTask($id: String!, $input: CompleteMaintenanceTaskInput, $createNextOccurrence: Boolean) {\n  completeMaintenanceTask(\n    id: $id\n    input: $input\n    createNextOccurrence: $createNextOccurrence\n  ) {\n    completed {\n      id\n      status\n      completedAt\n      completedMileage\n      cost\n      partsCost\n      laborCost\n      currency\n    }\n    nextOccurrence {\n      id\n      title\n      description\n      dueDate\n      targetMileage\n      priority\n      status\n      isRecurring\n      intervalKm\n      intervalDays\n      source\n      motorcycleId\n      createdAt\n    }\n  }\n}": typeof types.CompleteMaintenanceTaskDocument,
    "mutation CompleteOnboarding($input: CompleteOnboardingInput!) {\n  completeOnboarding(input: $input) {\n    id\n    preferences\n    currency\n    createdAt\n    updatedAt\n  }\n}": typeof types.CompleteOnboardingDocument,
    "mutation CreateComment($input: CreateCommentInput!) {\n  createComment(input: $input) {\n    id\n    text\n    createdAt\n    flaggedCount\n    parentCommentId\n    author {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n  }\n}": typeof types.CreateCommentDocument,
    "mutation CreateDiagnostic($input: CreateDiagnosticInput!) {\n  createDiagnostic(input: $input) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}": typeof types.CreateDiagnosticDocument,
    "mutation CreateFlag($input: CreateFlagInput!) {\n  createFlag(input: $input) {\n    id\n    articleId\n    userId\n    sectionReference\n    comment\n    status\n    createdAt\n  }\n}": typeof types.CreateFlagDocument,
    "mutation CreateFuelLog($input: CreateFuelLogInput!) {\n  createFuelLog(input: $input) {\n    id\n    odometerKm\n    fuelLitres\n    totalCost\n    currency\n    fuelType\n    isPartial\n    filledAt\n    litresPer100Km\n    mpgUs\n  }\n}": typeof types.CreateFuelLogDocument,
    "mutation CreateGroupRide($input: CreateGroupRideInput!) {\n  createGroupRide(input: $input) {\n    id\n    title\n  }\n}": typeof types.CreateGroupRideDocument,
    "mutation CreateMaintenanceTask($input: CreateMaintenanceTaskInput!) {\n  createMaintenanceTask(input: $input) {\n    id\n    title\n    priority\n    status\n    dueDate\n    targetMileage\n    isRecurring\n    intervalKm\n    intervalDays\n    remind30d\n    remind7d\n    remind1d\n    createdAt\n  }\n}": typeof types.CreateMaintenanceTaskDocument,
    "mutation CreateMotorcycle($input: CreateMotorcycleInput!) {\n  createMotorcycle(input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n    isPrimary\n    createdAt\n  }\n}": typeof types.CreateMotorcycleDocument,
    "mutation CreateRouteReview($input: CreateRouteReviewInput!) {\n  createRouteReview(input: $input) {\n    id\n    rating\n    text\n    conditionTags\n    createdAt\n    author {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n  }\n}": typeof types.CreateRouteReviewDocument,
    "mutation CreateShareLink($input: CreateShareLinkInput!) {\n  createShareLink(input: $input) {\n    id\n    token\n    motorcycleId\n    expiresAt\n    createdAt\n    url\n  }\n}": typeof types.CreateShareLinkDocument,
    "mutation CreateTripWithWaypoints($input: CreateTripWithWaypointsInput!) {\n  createTripWithWaypoints(input: $input) {\n    id\n    title\n    description\n    startDate\n    endDate\n    difficulty\n    maxRiders\n    status\n    visibility\n    createdAt\n    organiser {\n      id\n      displayName\n    }\n    waypoints {\n      id\n      tripId\n      sortOrder\n      dayIndex\n      type\n      name\n      notes\n      lat\n      lng\n    }\n  }\n}": typeof types.CreateTripWithWaypointsDocument,
    "mutation CreateTrip($input: CreateTripInput!) {\n  createTrip(input: $input) {\n    id\n    title\n    description\n    startDate\n    endDate\n    difficulty\n    maxRiders\n    status\n    createdAt\n    organiser {\n      id\n      displayName\n    }\n  }\n}": typeof types.CreateTripDocument,
    "mutation DeleteAccount {\n  deleteAccount\n}": typeof types.DeleteAccountDocument,
    "mutation DeleteComment($commentId: ID!) {\n  deleteComment(commentId: $commentId)\n}": typeof types.DeleteCommentDocument,
    "mutation DeleteExpensePhoto($photoId: String!) {\n  deleteExpensePhoto(photoId: $photoId)\n}": typeof types.DeleteExpensePhotoDocument,
    "mutation DeleteExpense($id: String!) {\n  deleteExpense(id: $id)\n}": typeof types.DeleteExpenseDocument,
    "mutation DeleteFuelLog($id: String!) {\n  deleteFuelLog(id: $id)\n}": typeof types.DeleteFuelLogDocument,
    "mutation DeleteMaintenanceTask($id: String!) {\n  deleteMaintenanceTask(id: $id)\n}": typeof types.DeleteMaintenanceTaskDocument,
    "mutation DeleteMotorcycle($id: String!) {\n  deleteMotorcycle(id: $id)\n}": typeof types.DeleteMotorcycleDocument,
    "mutation DeleteRide($id: String!) {\n  deleteRide(id: $id)\n}": typeof types.DeleteRideDocument,
    "mutation DeleteTaskPhoto($photoId: ID!) {\n  deleteTaskPhoto(photoId: $photoId)\n}": typeof types.DeleteTaskPhotoDocument,
    "mutation DeleteTrip($tripId: ID!) {\n  deleteTrip(tripId: $tripId)\n}": typeof types.DeleteTripDocument,
    "mutation EndRide($input: EndRideInput!) {\n  endRide(input: $input) {\n    ride {\n      id\n      status\n      endedAt\n      distanceM\n      maxSpeedMps\n      avgSpeedMps\n      elevationGain\n      elevationLoss\n      pausedDurationS\n      autoPausedDurationS\n      gpsQuality\n      routePolyline\n      mileageApplied\n    }\n    triggeredMaintenanceTasks {\n      id\n      title\n      priority\n    }\n  }\n}": typeof types.EndRideDocument,
    "mutation FlagComment($commentId: ID!) {\n  flagComment(commentId: $commentId)\n}": typeof types.FlagCommentDocument,
    "mutation FollowRider($input: FollowRiderInput!) {\n  followRider(input: $input) {\n    followerId\n    followingId\n    createdAt\n  }\n}": typeof types.FollowRiderDocument,
    "mutation GenerateArticle($input: GenerateArticleInput!) {\n  generateArticle(input: $input) {\n    id\n    slug\n    title\n    difficulty\n    category\n    contentJson\n    readTime\n    generatedAt\n  }\n}": typeof types.GenerateArticleDocument,
    "mutation GenerateBikeHealthReport($input: GenerateReportInput!) {\n  generateBikeHealthReport(input: $input) {\n    id\n    userId\n    motorcycleId\n    status\n    pdfUrl\n    iapTransactionId\n    createdAt\n    completedAt\n  }\n}": typeof types.GenerateBikeHealthReportDocument,
    "mutation GenerateOnboardingInsights($input: GenerateInsightsInput!) {\n  generateOnboardingInsights(input: $input) {\n    icon\n    title\n    body\n    type\n  }\n}": typeof types.GenerateOnboardingInsightsDocument,
    "mutation ImportOemSchedule($motorcycleId: String!) {\n  importOemSchedule(motorcycleId: $motorcycleId)\n}": typeof types.ImportOemScheduleDocument,
    "mutation InviteToTrip($tripId: ID!, $invitedUserId: ID!) {\n  inviteToTrip(tripId: $tripId, invitedUserId: $invitedUserId)\n}": typeof types.InviteToTripDocument,
    "mutation JoinGroupRide($groupRideId: ID!) {\n  joinGroupRide(groupRideId: $groupRideId)\n}": typeof types.JoinGroupRideDocument,
    "mutation JoinPremiumWaitlist($feature: String!) {\n  joinPremiumWaitlist(feature: $feature)\n}": typeof types.JoinPremiumWaitlistDocument,
    "mutation JoinTrip($input: JoinTripInput!) {\n  joinTrip(input: $input)\n}": typeof types.JoinTripDocument,
    "mutation LeaveGroupRide($groupRideId: ID!) {\n  leaveGroupRide(groupRideId: $groupRideId)\n}": typeof types.LeaveGroupRideDocument,
    "mutation LeaveTrip($tripId: ID!) {\n  leaveTrip(tripId: $tripId)\n}": typeof types.LeaveTripDocument,
    "mutation LogExpense($input: LogExpenseInput!) {\n  logExpense(input: $input) {\n    id\n    amount\n    category\n    currency\n    description\n    date\n    createdAt\n  }\n}": typeof types.LogExpenseDocument,
    "mutation MarkArticleRead($articleId: String!) {\n  markArticleRead(articleId: $articleId) {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}": typeof types.MarkArticleReadDocument,
    "mutation PublishTrip($tripId: ID!) {\n  publishTrip(tripId: $tripId) {\n    id\n    status\n  }\n}": typeof types.PublishTripDocument,
    "mutation RegenerateRideSummary($rideId: String!) {\n  regenerateRideSummary(rideId: $rideId) {\n    id\n    rideId\n    summaryText\n    generationStatus\n    locale\n    createdAt\n    updatedAt\n  }\n}": typeof types.RegenerateRideSummaryDocument,
    "mutation RemoveWaypoint($waypointId: ID!) {\n  removeWaypoint(waypointId: $waypointId)\n}": typeof types.RemoveWaypointDocument,
    "mutation ReorderWaypoints($input: ReorderWaypointsInput!) {\n  reorderWaypoints(input: $input)\n}": typeof types.ReorderWaypointsDocument,
    "mutation RequestDataExport {\n  requestDataExport {\n    id\n    status\n    requestedAt\n  }\n}": typeof types.RequestDataExportDocument,
    "mutation RespondToTripInvite($inviteId: ID!, $accept: Boolean!) {\n  respondToTripInvite(inviteId: $inviteId, accept: $accept)\n}": typeof types.RespondToTripInviteDocument,
    "mutation RevokeShareLink($linkId: ID!) {\n  revokeShareLink(linkId: $linkId)\n}": typeof types.RevokeShareLinkDocument,
    "mutation RotateTripShareToken($tripId: ID!) {\n  rotateTripShareToken(tripId: $tripId)\n}": typeof types.RotateTripShareTokenDocument,
    "mutation SaveRoute($routeId: ID!) {\n  saveRoute(routeId: $routeId)\n}": typeof types.SaveRouteDocument,
    "mutation ShareRideToDiscover($input: ShareRideToDiscoverInput!) {\n  shareRideToDiscover(input: $input) {\n    id\n    name\n    distanceM\n  }\n}": typeof types.ShareRideToDiscoverDocument,
    "mutation ShareRide($rideId: String!, $sharedWithUserId: String!) {\n  shareRide(rideId: $rideId, sharedWithUserId: $sharedWithUserId)\n}": typeof types.ShareRideDocument,
    "mutation StartRide($input: StartRideInput!) {\n  startRide(input: $input) {\n    id\n    status\n    startedAt\n    motorcycleId\n  }\n}": typeof types.StartRideDocument,
    "mutation SubmitDiagnostic($input: SubmitDiagnosticInput!) {\n  submitDiagnostic(input: $input) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    resultJson\n    description\n    photoUrl\n    status\n    createdAt\n  }\n}": typeof types.SubmitDiagnosticDocument,
    "mutation ToggleKudos($rideId: String!) {\n  toggleKudos(rideId: $rideId) {\n    hasKudos\n    kudosCount\n  }\n}": typeof types.ToggleKudosDocument,
    "mutation TrackAffiliateClick($input: TrackClickInput!) {\n  trackAffiliateClick(input: $input) {\n    partner\n    affiliateUrl\n    productUrl\n    tracked\n  }\n}": typeof types.TrackAffiliateClickDocument,
    "mutation UnfollowRider($input: UnfollowRiderInput!) {\n  unfollowRider(input: $input)\n}": typeof types.UnfollowRiderDocument,
    "mutation UnsaveRoute($routeId: ID!) {\n  unsaveRoute(routeId: $routeId)\n}": typeof types.UnsaveRouteDocument,
    "mutation UnshareRide($rideId: String!, $sharedWithUserId: String!) {\n  unshareRide(rideId: $rideId, sharedWithUserId: $sharedWithUserId)\n}": typeof types.UnshareRideDocument,
    "mutation UnshareRoute($routeId: ID!) {\n  unshareRoute(routeId: $routeId)\n}": typeof types.UnshareRouteDocument,
    "mutation UpdateMotorcycle($id: String!, $input: UpdateMotorcycleInput!) {\n  updateMotorcycle(id: $id, input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n    isPrimary\n    primaryPhotoUrl\n    currentMileage\n    mileageUnit\n    mileageUpdatedAt\n    purchasePrice\n    purchaseDate\n    vin\n    recallCount\n    recallLastCheckedAt\n  }\n}": typeof types.UpdateMotorcycleDocument,
    "mutation UpdateMyProfile($input: UpdateProfileInput!) {\n  updateMyProfile(input: $input) {\n    id\n    fullName\n    publicUsername\n    displayName\n    bio\n    city\n    isPublic\n    followerCount\n    followingCount\n  }\n}": typeof types.UpdateMyProfileDocument,
    "mutation UpdateParticipantStatus($input: UpdateParticipantStatusInput!) {\n  updateParticipantStatus(input: $input)\n}": typeof types.UpdateParticipantStatusDocument,
    "mutation UpdateRideVisibility($rideId: String!, $visibility: String!) {\n  updateRideVisibility(rideId: $rideId, visibility: $visibility) {\n    id\n    visibility\n    isPublic\n  }\n}": typeof types.UpdateRideVisibilityDocument,
    "mutation UpdateRide($input: UpdateRideInput!) {\n  updateRide(input: $input) {\n    id\n    name\n    mileageApplied\n    isPublic\n  }\n}": typeof types.UpdateRideDocument,
    "mutation UpdateTrip($input: UpdateTripInput!) {\n  updateTrip(input: $input) {\n    id\n    title\n    description\n    startDate\n    endDate\n    difficulty\n    maxRiders\n    status\n    visibility\n    waypoints {\n      id\n      tripId\n      sortOrder\n      dayIndex\n      type\n      name\n      notes\n      lat\n      lng\n    }\n  }\n}": typeof types.UpdateTripDocument,
    "mutation UpdateUser($input: UpdateUserInput!) {\n  updateUser(input: $input) {\n    id\n    fullName\n    preferences\n    measurementSystem\n    currency\n  }\n}": typeof types.UpdateUserDocument,
    "mutation UpdateWaypoint($input: UpdateWaypointInput!) {\n  updateWaypoint(input: $input) {\n    id\n    sortOrder\n    dayIndex\n    type\n    name\n    notes\n    lat\n    lng\n  }\n}": typeof types.UpdateWaypointDocument,
    "mutation UploadWaypoints($input: UploadWaypointsInput!) {\n  uploadWaypoints(input: $input)\n}": typeof types.UploadWaypointsDocument,
    "query AllMaintenanceTasks {\n  allMaintenanceTasks {\n    id\n    motorcycleId\n    title\n    dueDate\n    targetMileage\n    priority\n    status\n    completedAt\n  }\n}": typeof types.AllMaintenanceTasksDocument,
    "query ArticleBySlugFull($slug: String!) {\n  articleBySlugFull(slug: $slug) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    contentJson\n    readTime\n    generatedAt\n    updatedAt\n  }\n}": typeof types.ArticleBySlugFullDocument,
    "query DiagnosticById($id: String!) {\n  diagnosticById(id: $id) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    resultJson\n    description\n    photoUrl\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}": typeof types.DiagnosticByIdDocument,
    "query DiscoverRoutes($filter: DiscoverRoutesFilterInput, $first: Int, $after: String) {\n  discoverRoutes(filter: $filter, first: $first, after: $after) {\n    edges {\n      node {\n        id\n        name\n        polyline\n        distanceM\n        elevationGainM\n        surfaceType\n        curvatureIndex\n        isMotovaultPick\n        editorialDescription\n        ratingAvg\n        ratingCount\n        commentCount\n        createdAt\n        startLat\n        startLng\n        contributor {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}": typeof types.DiscoverRoutesDocument,
    "query ExpenseDashboard($motorcycleId: String!) {\n  expenseDashboard(motorcycleId: $motorcycleId) {\n    currentYearTotal\n    previousYearTotal\n    allTimeTotal\n    expenseCount\n    monthlyBuckets {\n      month\n      year\n      fuel\n      maintenance\n      parts\n      gear\n      tires\n      insurance\n      registration\n      tolls\n      parking\n      modifications\n      training\n      total\n    }\n    categoryTotals {\n      category\n      total\n    }\n  }\n}": typeof types.ExpenseDashboardDocument,
    "query ExpensePhotos($expenseId: String!) {\n  expensePhotos(expenseId: $expenseId) {\n    id\n    expenseId\n    storagePath\n    publicUrl\n    fileSizeBytes\n    mimeType\n    createdAt\n  }\n}": typeof types.ExpensePhotosDocument,
    "query ExpensesByMotorcycle($motorcycleId: String!, $year: Int!) {\n  expenses(motorcycleId: $motorcycleId, year: $year) {\n    ytdTotal\n    categories {\n      category\n      total\n      expenses {\n        id\n        amount\n        category\n        currency\n        description\n        date\n        createdAt\n      }\n    }\n  }\n}": typeof types.ExpensesByMotorcycleDocument,
    "query FuelLogs($motorcycleId: String!) {\n  fuelLogs(motorcycleId: $motorcycleId) {\n    id\n    motorcycleId\n    odometerKm\n    fuelLitres\n    totalCost\n    currency\n    fuelType\n    isPartial\n    notes\n    filledAt\n    kmSincePrevious\n    litresPer100Km\n    mpgUs\n  }\n}": typeof types.FuelLogsDocument,
    "query GetArticleBySlug($slug: String!) {\n  articleBySlug(slug: $slug) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    generatedAt\n    updatedAt\n  }\n}": typeof types.GetArticleBySlugDocument,
    "query GetComments($rideId: ID, $routeId: ID, $groupRideId: ID, $tripId: ID, $first: Int, $after: String) {\n  getComments(\n    rideId: $rideId\n    routeId: $routeId\n    groupRideId: $groupRideId\n    tripId: $tripId\n    first: $first\n    after: $after\n  ) {\n    comments {\n      id\n      text\n      createdAt\n      flaggedCount\n      parentCommentId\n      author {\n        id\n        displayName\n        publicUsername\n        avatarUrl\n      }\n      replies {\n        id\n        text\n        createdAt\n        flaggedCount\n        parentCommentId\n        author {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n    }\n    hasNextPage\n    endCursor\n    totalCount\n  }\n}": typeof types.GetCommentsDocument,
    "query GetFollowers($userId: String!, $first: Int, $after: String) {\n  getFollowers(userId: $userId, first: $first, after: $after) {\n    edges {\n      node {\n        followerId\n        followingId\n        createdAt\n        displayName\n        publicUsername\n        avatarUrl\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}": typeof types.GetFollowersDocument,
    "query GetFollowing($userId: String!, $first: Int, $after: String) {\n  getFollowing(userId: $userId, first: $first, after: $after) {\n    edges {\n      node {\n        followerId\n        followingId\n        createdAt\n        displayName\n        publicUsername\n        avatarUrl\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}": typeof types.GetFollowingDocument,
    "query GetGroupRides($first: Int, $after: String) {\n  getGroupRides(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        title\n        description\n        dateTime\n        meetingPointLat\n        meetingPointLng\n        meetingPointName\n        routeId\n        difficulty\n        maxRiders\n        participantCount\n        status\n        createdAt\n        organiser {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}": typeof types.GetGroupRidesDocument,
    "query GetKudosList($rideId: String!, $first: Int, $after: String) {\n  kudosList(rideId: $rideId, first: $first, after: $after) {\n    id\n    displayName\n    avatarUrl\n    publicUsername\n  }\n}": typeof types.GetKudosListDocument,
    "query GetRideWaypoints($rideId: String!, $maxPoints: Int) {\n  rideWaypoints(rideId: $rideId, maxPoints: $maxPoints) {\n    recordedAt\n    latitude\n    longitude\n    altitude\n    speedMps\n  }\n}": typeof types.GetRideWaypointsDocument,
    "query GetRide($id: String!) {\n  ride(id: $id) {\n    id\n    status\n    name\n    startedAt\n    endedAt\n    distanceM\n    maxSpeedMps\n    avgSpeedMps\n    elevationGain\n    elevationLoss\n    pausedDurationS\n    autoPausedDurationS\n    durationS\n    motorcycleId\n    routePolyline\n    routeThumbnailUri\n    gpsQuality\n    mileageApplied\n    isPublic\n    createdAt\n  }\n}": typeof types.GetRideDocument,
    "query GetRiderProfile($username: String!) {\n  getRiderProfile(username: $username) {\n    id\n    publicUsername\n    displayName\n    bio\n    city\n    avatarUrl\n    followerCount\n    followingCount\n    isFollowing\n    bikes {\n      make\n      model\n      year\n      nickname\n    }\n    rideStats {\n      totalRides\n      totalDistance\n      joinDate\n    }\n  }\n}": typeof types.GetRiderProfileDocument,
    "query GetRouteReviews($routeId: ID!, $first: Int, $after: String) {\n  getRouteReviews(routeId: $routeId, first: $first, after: $after) {\n    reviews {\n      id\n      rating\n      text\n      conditionTags\n      createdAt\n      author {\n        id\n        displayName\n        publicUsername\n        avatarUrl\n      }\n      bike {\n        make\n        model\n        year\n      }\n    }\n    hasNextPage\n    endCursor\n    totalCount\n  }\n}": typeof types.GetRouteReviewsDocument,
    "query GetTrips($first: Int, $after: String) {\n  getTrips(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        title\n        description\n        startDate\n        endDate\n        difficulty\n        maxRiders\n        participantCount\n        status\n        visibility\n        coverImageUrl\n        createdAt\n        organiser {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n        waypoints {\n          id\n          sortOrder\n          dayIndex\n          lat\n          lng\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}": typeof types.GetTripsDocument,
    "query GroupRideDetail($groupRideId: ID!) {\n  groupRideDetail(groupRideId: $groupRideId) {\n    id\n    title\n    description\n    dateTime\n    meetingPointLat\n    meetingPointLng\n    meetingPointName\n    routeId\n    routeDescription\n    difficulty\n    maxRiders\n    participantCount\n    status\n    createdAt\n    organiser {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n    participants {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n      joinedAt\n    }\n  }\n}": typeof types.GroupRideDetailDocument,
    "query ListPopularArticles($first: Int) {\n  popularArticles(first: $first) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    generatedAt\n    readTime\n    keywords\n  }\n}": typeof types.ListPopularArticlesDocument,
    "query MaintenanceTaskHistory($motorcycleId: String!, $limit: Int) {\n  maintenanceTaskHistory(motorcycleId: $motorcycleId, limit: $limit) {\n    id\n    userId\n    motorcycleId\n    title\n    description\n    dueDate\n    targetMileage\n    priority\n    status\n    notes\n    partsNeeded\n    completedAt\n    completedMileage\n    source\n    oemScheduleId\n    intervalKm\n    intervalDays\n    isRecurring\n    createdAt\n    updatedAt\n  }\n}": typeof types.MaintenanceTaskHistoryDocument,
    "query MaintenanceTasksByMotorcycle($motorcycleId: String!) {\n  maintenanceTasks(motorcycleId: $motorcycleId) {\n    id\n    userId\n    motorcycleId\n    title\n    description\n    dueDate\n    targetMileage\n    priority\n    status\n    notes\n    partsNeeded\n    completedAt\n    completedMileage\n    cost\n    partsCost\n    laborCost\n    currency\n    source\n    isRecurring\n    intervalKm\n    intervalDays\n    remind30d\n    remind7d\n    remind1d\n    photos {\n      id\n      storagePath\n      publicUrl\n    }\n    createdAt\n    updatedAt\n  }\n}": typeof types.MaintenanceTasksByMotorcycleDocument,
    "query Me {\n  me {\n    id\n    email\n    fullName\n    role\n    preferences\n    measurementSystem\n    currency\n    publicUsername\n    displayName\n    bio\n    city\n    isPublic\n    followerCount\n    followingCount\n    avatarUrl\n    createdAt\n    updatedAt\n  }\n}": typeof types.MeDocument,
    "query MotorcycleMakes {\n  motorcycleMakes {\n    makeId\n    makeName\n    isPopular\n  }\n}": typeof types.MotorcycleMakesDocument,
    "query MotorcycleModels($makeId: Int!, $year: Int!) {\n  motorcycleModels(makeId: $makeId, year: $year) {\n    modelId\n    modelName\n  }\n}": typeof types.MotorcycleModelsDocument,
    "query MotorcycleRecalls($motorcycleId: String!) {\n  motorcycleRecalls(motorcycleId: $motorcycleId) {\n    count\n    checkedAt\n    vinUsed\n    recalls {\n      campaignNumber\n      reportDate\n      component\n      summary\n      consequence\n      remedy\n    }\n  }\n}": typeof types.MotorcycleRecallsDocument,
    "query MyDiagnostics {\n  myDiagnostics {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}": typeof types.MyDiagnosticsDocument,
    "query GetMyHealthReports {\n  getMyHealthReports {\n    id\n    userId\n    motorcycleId\n    status\n    pdfUrl\n    iapTransactionId\n    createdAt\n    completedAt\n  }\n}": typeof types.GetMyHealthReportsDocument,
    "query MyMotorcycles {\n  myMotorcycles {\n    id\n    userId\n    make\n    model\n    year\n    nickname\n    isPrimary\n    primaryPhotoUrl\n    currentMileage\n    mileageUnit\n    mileageUpdatedAt\n    purchasePrice\n    purchaseDate\n    type\n    engineCc\n    vin\n    recallCount\n    recallLastCheckedAt\n    odometerSyncSource\n    odometerLastRideId\n    createdAt\n  }\n}": typeof types.MyMotorcyclesDocument,
    "query MyProgress {\n  myProgress {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}": typeof types.MyProgressDocument,
    "query MyRides($first: Int, $after: String, $motorcycleId: String) {\n  myRides(first: $first, after: $after, motorcycleId: $motorcycleId) {\n    edges {\n      node {\n        id\n        status\n        name\n        startedAt\n        endedAt\n        distanceM\n        maxSpeedMps\n        avgSpeedMps\n        elevationGain\n        pausedDurationS\n        autoPausedDurationS\n        durationS\n        motorcycleId\n        routeThumbnailUri\n        gpsQuality\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    totalCount\n  }\n}": typeof types.MyRidesDocument,
    "query MyShareLinks($motorcycleId: ID!) {\n  myShareLinks(motorcycleId: $motorcycleId) {\n    id\n    token\n    motorcycleId\n    expiresAt\n    createdAt\n    url\n  }\n}": typeof types.MyShareLinksDocument,
    "query MyTrips($first: Int, $after: String) {\n  myTrips(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        title\n        description\n        startDate\n        endDate\n        difficulty\n        maxRiders\n        participantCount\n        status\n        coverImageUrl\n        createdAt\n        organiser {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}": typeof types.MyTripsDocument,
    "query GetRideFeed($first: Int, $after: String) {\n  rideFeed(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        name\n        distanceM\n        elevationGain\n        elevationLoss\n        startedAt\n        endedAt\n        aiSummary\n        kudosCount\n        commentCount\n        hasKudos\n        routeThumbnailUri\n        rider {\n          displayName\n          avatarUrl\n          publicUsername\n        }\n        bike {\n          make\n          model\n          year\n          nickname\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n  }\n}": typeof types.GetRideFeedDocument,
    "query RouteDetail($routeId: ID!) {\n  routeDetail(routeId: $routeId) {\n    id\n    name\n    description\n    polyline\n    distanceM\n    elevationGainM\n    surfaceType\n    curvatureIndex\n    isMotovaultPick\n    editorialDescription\n    ratingAvg\n    ratingCount\n    commentCount\n    status\n    createdAt\n    contributor {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n  }\n}": typeof types.RouteDetailDocument,
    "query SavedRoutes($first: Int, $after: String) {\n  savedRoutes(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        name\n        polyline\n        distanceM\n        elevationGainM\n        surfaceType\n        isMotovaultPick\n        ratingAvg\n        ratingCount\n        commentCount\n        createdAt\n        startLat\n        startLng\n        contributor {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}": typeof types.SavedRoutesDocument,
    "query SearchArticles($input: SearchArticlesInput!) {\n  searchArticles(input: $input) {\n    edges {\n      node {\n        id\n        slug\n        title\n        difficulty\n        category\n        viewCount\n        isSafetyCritical\n        generatedAt\n        updatedAt\n        keywords\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}": typeof types.SearchArticlesDocument,
    "query SpendingSummary($motorcycleId: String!) {\n  spendingSummary(motorcycleId: $motorcycleId) {\n    thisYear\n    allTime\n  }\n}": typeof types.SpendingSummaryDocument,
    "query TripByShareToken($shareToken: String!) {\n  tripByShareToken(shareToken: $shareToken) {\n    id\n    title\n    description\n    status\n    difficulty\n    startDate\n    endDate\n    maxRiders\n    participantCount\n    coverImageUrl\n    waypoints {\n      id\n      sortOrder\n      dayIndex\n      type\n      name\n      notes\n      lat\n      lng\n    }\n    participants {\n      anonId\n      role\n      status\n      displayName\n      avatarUrl\n    }\n  }\n}": typeof types.TripByShareTokenDocument,
    "query TripDetail($tripId: ID!) {\n  tripDetail(tripId: $tripId) {\n    id\n    title\n    description\n    startDate\n    endDate\n    difficulty\n    maxRiders\n    participantCount\n    status\n    visibility\n    coverImageUrl\n    createdAt\n    organiser {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n    waypoints {\n      id\n      tripId\n      sortOrder\n      dayIndex\n      type\n      name\n      notes\n      lat\n      lng\n      createdAt\n    }\n    participants {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n      role\n      status\n      bikeId\n      joinedAt\n    }\n  }\n}": typeof types.TripDetailDocument,
    "query TripInvites($tripId: ID!) {\n  tripInvites(tripId: $tripId) {\n    id\n    invitedUserId\n    invitedAt\n    acceptedAt\n    declinedAt\n  }\n}": typeof types.TripInvitesDocument,
    "mutation JoinWaitlist($email: String!) {\n  joinWaitlist(email: $email)\n}": typeof types.JoinWaitlistDocument,
    "query RouteBySlug($country: String!, $region: String!, $slug: String!) {\n  routeBySlug(country: $country, region: $region, slug: $slug) {\n    id\n    name\n    description\n    distanceM\n    elevationGainM\n    surfaceType\n    curvatureIndex\n    isMotovaultPick\n    editorialDescription\n    ratingAvg\n    ratingCount\n    commentCount\n    startLat\n    startLng\n    slug\n    countryCode\n    regionSlug\n    contributor {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n  }\n}": typeof types.RouteBySlugDocument,
};
const documents: Documents = {
    "mutation AddExpensePhoto($input: AddExpensePhotoInput!) {\n  addExpensePhoto(input: $input) {\n    id\n    expenseId\n    storagePath\n    publicUrl\n    fileSizeBytes\n    mimeType\n    createdAt\n  }\n}": types.AddExpensePhotoDocument,
    "mutation AddTaskPhoto($input: AddTaskPhotoInput!) {\n  addTaskPhoto(input: $input) {\n    id\n    taskId\n    storagePath\n    publicUrl\n    fileSizeBytes\n    mimeType\n    createdAt\n  }\n}": types.AddTaskPhotoDocument,
    "mutation AddWaypoint($input: CreateWaypointInput!) {\n  addWaypoint(input: $input) {\n    id\n    tripId\n    sortOrder\n    dayIndex\n    type\n    name\n    notes\n    lat\n    lng\n    createdAt\n  }\n}": types.AddWaypointDocument,
    "mutation CancelGroupRide($groupRideId: ID!) {\n  cancelGroupRide(groupRideId: $groupRideId)\n}": types.CancelGroupRideDocument,
    "mutation CompleteMaintenanceTask($id: String!, $input: CompleteMaintenanceTaskInput, $createNextOccurrence: Boolean) {\n  completeMaintenanceTask(\n    id: $id\n    input: $input\n    createNextOccurrence: $createNextOccurrence\n  ) {\n    completed {\n      id\n      status\n      completedAt\n      completedMileage\n      cost\n      partsCost\n      laborCost\n      currency\n    }\n    nextOccurrence {\n      id\n      title\n      description\n      dueDate\n      targetMileage\n      priority\n      status\n      isRecurring\n      intervalKm\n      intervalDays\n      source\n      motorcycleId\n      createdAt\n    }\n  }\n}": types.CompleteMaintenanceTaskDocument,
    "mutation CompleteOnboarding($input: CompleteOnboardingInput!) {\n  completeOnboarding(input: $input) {\n    id\n    preferences\n    currency\n    createdAt\n    updatedAt\n  }\n}": types.CompleteOnboardingDocument,
    "mutation CreateComment($input: CreateCommentInput!) {\n  createComment(input: $input) {\n    id\n    text\n    createdAt\n    flaggedCount\n    parentCommentId\n    author {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n  }\n}": types.CreateCommentDocument,
    "mutation CreateDiagnostic($input: CreateDiagnosticInput!) {\n  createDiagnostic(input: $input) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}": types.CreateDiagnosticDocument,
    "mutation CreateFlag($input: CreateFlagInput!) {\n  createFlag(input: $input) {\n    id\n    articleId\n    userId\n    sectionReference\n    comment\n    status\n    createdAt\n  }\n}": types.CreateFlagDocument,
    "mutation CreateFuelLog($input: CreateFuelLogInput!) {\n  createFuelLog(input: $input) {\n    id\n    odometerKm\n    fuelLitres\n    totalCost\n    currency\n    fuelType\n    isPartial\n    filledAt\n    litresPer100Km\n    mpgUs\n  }\n}": types.CreateFuelLogDocument,
    "mutation CreateGroupRide($input: CreateGroupRideInput!) {\n  createGroupRide(input: $input) {\n    id\n    title\n  }\n}": types.CreateGroupRideDocument,
    "mutation CreateMaintenanceTask($input: CreateMaintenanceTaskInput!) {\n  createMaintenanceTask(input: $input) {\n    id\n    title\n    priority\n    status\n    dueDate\n    targetMileage\n    isRecurring\n    intervalKm\n    intervalDays\n    remind30d\n    remind7d\n    remind1d\n    createdAt\n  }\n}": types.CreateMaintenanceTaskDocument,
    "mutation CreateMotorcycle($input: CreateMotorcycleInput!) {\n  createMotorcycle(input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n    isPrimary\n    createdAt\n  }\n}": types.CreateMotorcycleDocument,
    "mutation CreateRouteReview($input: CreateRouteReviewInput!) {\n  createRouteReview(input: $input) {\n    id\n    rating\n    text\n    conditionTags\n    createdAt\n    author {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n  }\n}": types.CreateRouteReviewDocument,
    "mutation CreateShareLink($input: CreateShareLinkInput!) {\n  createShareLink(input: $input) {\n    id\n    token\n    motorcycleId\n    expiresAt\n    createdAt\n    url\n  }\n}": types.CreateShareLinkDocument,
    "mutation CreateTripWithWaypoints($input: CreateTripWithWaypointsInput!) {\n  createTripWithWaypoints(input: $input) {\n    id\n    title\n    description\n    startDate\n    endDate\n    difficulty\n    maxRiders\n    status\n    visibility\n    createdAt\n    organiser {\n      id\n      displayName\n    }\n    waypoints {\n      id\n      tripId\n      sortOrder\n      dayIndex\n      type\n      name\n      notes\n      lat\n      lng\n    }\n  }\n}": types.CreateTripWithWaypointsDocument,
    "mutation CreateTrip($input: CreateTripInput!) {\n  createTrip(input: $input) {\n    id\n    title\n    description\n    startDate\n    endDate\n    difficulty\n    maxRiders\n    status\n    createdAt\n    organiser {\n      id\n      displayName\n    }\n  }\n}": types.CreateTripDocument,
    "mutation DeleteAccount {\n  deleteAccount\n}": types.DeleteAccountDocument,
    "mutation DeleteComment($commentId: ID!) {\n  deleteComment(commentId: $commentId)\n}": types.DeleteCommentDocument,
    "mutation DeleteExpensePhoto($photoId: String!) {\n  deleteExpensePhoto(photoId: $photoId)\n}": types.DeleteExpensePhotoDocument,
    "mutation DeleteExpense($id: String!) {\n  deleteExpense(id: $id)\n}": types.DeleteExpenseDocument,
    "mutation DeleteFuelLog($id: String!) {\n  deleteFuelLog(id: $id)\n}": types.DeleteFuelLogDocument,
    "mutation DeleteMaintenanceTask($id: String!) {\n  deleteMaintenanceTask(id: $id)\n}": types.DeleteMaintenanceTaskDocument,
    "mutation DeleteMotorcycle($id: String!) {\n  deleteMotorcycle(id: $id)\n}": types.DeleteMotorcycleDocument,
    "mutation DeleteRide($id: String!) {\n  deleteRide(id: $id)\n}": types.DeleteRideDocument,
    "mutation DeleteTaskPhoto($photoId: ID!) {\n  deleteTaskPhoto(photoId: $photoId)\n}": types.DeleteTaskPhotoDocument,
    "mutation DeleteTrip($tripId: ID!) {\n  deleteTrip(tripId: $tripId)\n}": types.DeleteTripDocument,
    "mutation EndRide($input: EndRideInput!) {\n  endRide(input: $input) {\n    ride {\n      id\n      status\n      endedAt\n      distanceM\n      maxSpeedMps\n      avgSpeedMps\n      elevationGain\n      elevationLoss\n      pausedDurationS\n      autoPausedDurationS\n      gpsQuality\n      routePolyline\n      mileageApplied\n    }\n    triggeredMaintenanceTasks {\n      id\n      title\n      priority\n    }\n  }\n}": types.EndRideDocument,
    "mutation FlagComment($commentId: ID!) {\n  flagComment(commentId: $commentId)\n}": types.FlagCommentDocument,
    "mutation FollowRider($input: FollowRiderInput!) {\n  followRider(input: $input) {\n    followerId\n    followingId\n    createdAt\n  }\n}": types.FollowRiderDocument,
    "mutation GenerateArticle($input: GenerateArticleInput!) {\n  generateArticle(input: $input) {\n    id\n    slug\n    title\n    difficulty\n    category\n    contentJson\n    readTime\n    generatedAt\n  }\n}": types.GenerateArticleDocument,
    "mutation GenerateBikeHealthReport($input: GenerateReportInput!) {\n  generateBikeHealthReport(input: $input) {\n    id\n    userId\n    motorcycleId\n    status\n    pdfUrl\n    iapTransactionId\n    createdAt\n    completedAt\n  }\n}": types.GenerateBikeHealthReportDocument,
    "mutation GenerateOnboardingInsights($input: GenerateInsightsInput!) {\n  generateOnboardingInsights(input: $input) {\n    icon\n    title\n    body\n    type\n  }\n}": types.GenerateOnboardingInsightsDocument,
    "mutation ImportOemSchedule($motorcycleId: String!) {\n  importOemSchedule(motorcycleId: $motorcycleId)\n}": types.ImportOemScheduleDocument,
    "mutation InviteToTrip($tripId: ID!, $invitedUserId: ID!) {\n  inviteToTrip(tripId: $tripId, invitedUserId: $invitedUserId)\n}": types.InviteToTripDocument,
    "mutation JoinGroupRide($groupRideId: ID!) {\n  joinGroupRide(groupRideId: $groupRideId)\n}": types.JoinGroupRideDocument,
    "mutation JoinPremiumWaitlist($feature: String!) {\n  joinPremiumWaitlist(feature: $feature)\n}": types.JoinPremiumWaitlistDocument,
    "mutation JoinTrip($input: JoinTripInput!) {\n  joinTrip(input: $input)\n}": types.JoinTripDocument,
    "mutation LeaveGroupRide($groupRideId: ID!) {\n  leaveGroupRide(groupRideId: $groupRideId)\n}": types.LeaveGroupRideDocument,
    "mutation LeaveTrip($tripId: ID!) {\n  leaveTrip(tripId: $tripId)\n}": types.LeaveTripDocument,
    "mutation LogExpense($input: LogExpenseInput!) {\n  logExpense(input: $input) {\n    id\n    amount\n    category\n    currency\n    description\n    date\n    createdAt\n  }\n}": types.LogExpenseDocument,
    "mutation MarkArticleRead($articleId: String!) {\n  markArticleRead(articleId: $articleId) {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}": types.MarkArticleReadDocument,
    "mutation PublishTrip($tripId: ID!) {\n  publishTrip(tripId: $tripId) {\n    id\n    status\n  }\n}": types.PublishTripDocument,
    "mutation RegenerateRideSummary($rideId: String!) {\n  regenerateRideSummary(rideId: $rideId) {\n    id\n    rideId\n    summaryText\n    generationStatus\n    locale\n    createdAt\n    updatedAt\n  }\n}": types.RegenerateRideSummaryDocument,
    "mutation RemoveWaypoint($waypointId: ID!) {\n  removeWaypoint(waypointId: $waypointId)\n}": types.RemoveWaypointDocument,
    "mutation ReorderWaypoints($input: ReorderWaypointsInput!) {\n  reorderWaypoints(input: $input)\n}": types.ReorderWaypointsDocument,
    "mutation RequestDataExport {\n  requestDataExport {\n    id\n    status\n    requestedAt\n  }\n}": types.RequestDataExportDocument,
    "mutation RespondToTripInvite($inviteId: ID!, $accept: Boolean!) {\n  respondToTripInvite(inviteId: $inviteId, accept: $accept)\n}": types.RespondToTripInviteDocument,
    "mutation RevokeShareLink($linkId: ID!) {\n  revokeShareLink(linkId: $linkId)\n}": types.RevokeShareLinkDocument,
    "mutation RotateTripShareToken($tripId: ID!) {\n  rotateTripShareToken(tripId: $tripId)\n}": types.RotateTripShareTokenDocument,
    "mutation SaveRoute($routeId: ID!) {\n  saveRoute(routeId: $routeId)\n}": types.SaveRouteDocument,
    "mutation ShareRideToDiscover($input: ShareRideToDiscoverInput!) {\n  shareRideToDiscover(input: $input) {\n    id\n    name\n    distanceM\n  }\n}": types.ShareRideToDiscoverDocument,
    "mutation ShareRide($rideId: String!, $sharedWithUserId: String!) {\n  shareRide(rideId: $rideId, sharedWithUserId: $sharedWithUserId)\n}": types.ShareRideDocument,
    "mutation StartRide($input: StartRideInput!) {\n  startRide(input: $input) {\n    id\n    status\n    startedAt\n    motorcycleId\n  }\n}": types.StartRideDocument,
    "mutation SubmitDiagnostic($input: SubmitDiagnosticInput!) {\n  submitDiagnostic(input: $input) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    resultJson\n    description\n    photoUrl\n    status\n    createdAt\n  }\n}": types.SubmitDiagnosticDocument,
    "mutation ToggleKudos($rideId: String!) {\n  toggleKudos(rideId: $rideId) {\n    hasKudos\n    kudosCount\n  }\n}": types.ToggleKudosDocument,
    "mutation TrackAffiliateClick($input: TrackClickInput!) {\n  trackAffiliateClick(input: $input) {\n    partner\n    affiliateUrl\n    productUrl\n    tracked\n  }\n}": types.TrackAffiliateClickDocument,
    "mutation UnfollowRider($input: UnfollowRiderInput!) {\n  unfollowRider(input: $input)\n}": types.UnfollowRiderDocument,
    "mutation UnsaveRoute($routeId: ID!) {\n  unsaveRoute(routeId: $routeId)\n}": types.UnsaveRouteDocument,
    "mutation UnshareRide($rideId: String!, $sharedWithUserId: String!) {\n  unshareRide(rideId: $rideId, sharedWithUserId: $sharedWithUserId)\n}": types.UnshareRideDocument,
    "mutation UnshareRoute($routeId: ID!) {\n  unshareRoute(routeId: $routeId)\n}": types.UnshareRouteDocument,
    "mutation UpdateMotorcycle($id: String!, $input: UpdateMotorcycleInput!) {\n  updateMotorcycle(id: $id, input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n    isPrimary\n    primaryPhotoUrl\n    currentMileage\n    mileageUnit\n    mileageUpdatedAt\n    purchasePrice\n    purchaseDate\n    vin\n    recallCount\n    recallLastCheckedAt\n  }\n}": types.UpdateMotorcycleDocument,
    "mutation UpdateMyProfile($input: UpdateProfileInput!) {\n  updateMyProfile(input: $input) {\n    id\n    fullName\n    publicUsername\n    displayName\n    bio\n    city\n    isPublic\n    followerCount\n    followingCount\n  }\n}": types.UpdateMyProfileDocument,
    "mutation UpdateParticipantStatus($input: UpdateParticipantStatusInput!) {\n  updateParticipantStatus(input: $input)\n}": types.UpdateParticipantStatusDocument,
    "mutation UpdateRideVisibility($rideId: String!, $visibility: String!) {\n  updateRideVisibility(rideId: $rideId, visibility: $visibility) {\n    id\n    visibility\n    isPublic\n  }\n}": types.UpdateRideVisibilityDocument,
    "mutation UpdateRide($input: UpdateRideInput!) {\n  updateRide(input: $input) {\n    id\n    name\n    mileageApplied\n    isPublic\n  }\n}": types.UpdateRideDocument,
    "mutation UpdateTrip($input: UpdateTripInput!) {\n  updateTrip(input: $input) {\n    id\n    title\n    description\n    startDate\n    endDate\n    difficulty\n    maxRiders\n    status\n    visibility\n    waypoints {\n      id\n      tripId\n      sortOrder\n      dayIndex\n      type\n      name\n      notes\n      lat\n      lng\n    }\n  }\n}": types.UpdateTripDocument,
    "mutation UpdateUser($input: UpdateUserInput!) {\n  updateUser(input: $input) {\n    id\n    fullName\n    preferences\n    measurementSystem\n    currency\n  }\n}": types.UpdateUserDocument,
    "mutation UpdateWaypoint($input: UpdateWaypointInput!) {\n  updateWaypoint(input: $input) {\n    id\n    sortOrder\n    dayIndex\n    type\n    name\n    notes\n    lat\n    lng\n  }\n}": types.UpdateWaypointDocument,
    "mutation UploadWaypoints($input: UploadWaypointsInput!) {\n  uploadWaypoints(input: $input)\n}": types.UploadWaypointsDocument,
    "query AllMaintenanceTasks {\n  allMaintenanceTasks {\n    id\n    motorcycleId\n    title\n    dueDate\n    targetMileage\n    priority\n    status\n    completedAt\n  }\n}": types.AllMaintenanceTasksDocument,
    "query ArticleBySlugFull($slug: String!) {\n  articleBySlugFull(slug: $slug) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    contentJson\n    readTime\n    generatedAt\n    updatedAt\n  }\n}": types.ArticleBySlugFullDocument,
    "query DiagnosticById($id: String!) {\n  diagnosticById(id: $id) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    resultJson\n    description\n    photoUrl\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}": types.DiagnosticByIdDocument,
    "query DiscoverRoutes($filter: DiscoverRoutesFilterInput, $first: Int, $after: String) {\n  discoverRoutes(filter: $filter, first: $first, after: $after) {\n    edges {\n      node {\n        id\n        name\n        polyline\n        distanceM\n        elevationGainM\n        surfaceType\n        curvatureIndex\n        isMotovaultPick\n        editorialDescription\n        ratingAvg\n        ratingCount\n        commentCount\n        createdAt\n        startLat\n        startLng\n        contributor {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}": types.DiscoverRoutesDocument,
    "query ExpenseDashboard($motorcycleId: String!) {\n  expenseDashboard(motorcycleId: $motorcycleId) {\n    currentYearTotal\n    previousYearTotal\n    allTimeTotal\n    expenseCount\n    monthlyBuckets {\n      month\n      year\n      fuel\n      maintenance\n      parts\n      gear\n      tires\n      insurance\n      registration\n      tolls\n      parking\n      modifications\n      training\n      total\n    }\n    categoryTotals {\n      category\n      total\n    }\n  }\n}": types.ExpenseDashboardDocument,
    "query ExpensePhotos($expenseId: String!) {\n  expensePhotos(expenseId: $expenseId) {\n    id\n    expenseId\n    storagePath\n    publicUrl\n    fileSizeBytes\n    mimeType\n    createdAt\n  }\n}": types.ExpensePhotosDocument,
    "query ExpensesByMotorcycle($motorcycleId: String!, $year: Int!) {\n  expenses(motorcycleId: $motorcycleId, year: $year) {\n    ytdTotal\n    categories {\n      category\n      total\n      expenses {\n        id\n        amount\n        category\n        currency\n        description\n        date\n        createdAt\n      }\n    }\n  }\n}": types.ExpensesByMotorcycleDocument,
    "query FuelLogs($motorcycleId: String!) {\n  fuelLogs(motorcycleId: $motorcycleId) {\n    id\n    motorcycleId\n    odometerKm\n    fuelLitres\n    totalCost\n    currency\n    fuelType\n    isPartial\n    notes\n    filledAt\n    kmSincePrevious\n    litresPer100Km\n    mpgUs\n  }\n}": types.FuelLogsDocument,
    "query GetArticleBySlug($slug: String!) {\n  articleBySlug(slug: $slug) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    generatedAt\n    updatedAt\n  }\n}": types.GetArticleBySlugDocument,
    "query GetComments($rideId: ID, $routeId: ID, $groupRideId: ID, $tripId: ID, $first: Int, $after: String) {\n  getComments(\n    rideId: $rideId\n    routeId: $routeId\n    groupRideId: $groupRideId\n    tripId: $tripId\n    first: $first\n    after: $after\n  ) {\n    comments {\n      id\n      text\n      createdAt\n      flaggedCount\n      parentCommentId\n      author {\n        id\n        displayName\n        publicUsername\n        avatarUrl\n      }\n      replies {\n        id\n        text\n        createdAt\n        flaggedCount\n        parentCommentId\n        author {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n    }\n    hasNextPage\n    endCursor\n    totalCount\n  }\n}": types.GetCommentsDocument,
    "query GetFollowers($userId: String!, $first: Int, $after: String) {\n  getFollowers(userId: $userId, first: $first, after: $after) {\n    edges {\n      node {\n        followerId\n        followingId\n        createdAt\n        displayName\n        publicUsername\n        avatarUrl\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}": types.GetFollowersDocument,
    "query GetFollowing($userId: String!, $first: Int, $after: String) {\n  getFollowing(userId: $userId, first: $first, after: $after) {\n    edges {\n      node {\n        followerId\n        followingId\n        createdAt\n        displayName\n        publicUsername\n        avatarUrl\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}": types.GetFollowingDocument,
    "query GetGroupRides($first: Int, $after: String) {\n  getGroupRides(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        title\n        description\n        dateTime\n        meetingPointLat\n        meetingPointLng\n        meetingPointName\n        routeId\n        difficulty\n        maxRiders\n        participantCount\n        status\n        createdAt\n        organiser {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}": types.GetGroupRidesDocument,
    "query GetKudosList($rideId: String!, $first: Int, $after: String) {\n  kudosList(rideId: $rideId, first: $first, after: $after) {\n    id\n    displayName\n    avatarUrl\n    publicUsername\n  }\n}": types.GetKudosListDocument,
    "query GetRideWaypoints($rideId: String!, $maxPoints: Int) {\n  rideWaypoints(rideId: $rideId, maxPoints: $maxPoints) {\n    recordedAt\n    latitude\n    longitude\n    altitude\n    speedMps\n  }\n}": types.GetRideWaypointsDocument,
    "query GetRide($id: String!) {\n  ride(id: $id) {\n    id\n    status\n    name\n    startedAt\n    endedAt\n    distanceM\n    maxSpeedMps\n    avgSpeedMps\n    elevationGain\n    elevationLoss\n    pausedDurationS\n    autoPausedDurationS\n    durationS\n    motorcycleId\n    routePolyline\n    routeThumbnailUri\n    gpsQuality\n    mileageApplied\n    isPublic\n    createdAt\n  }\n}": types.GetRideDocument,
    "query GetRiderProfile($username: String!) {\n  getRiderProfile(username: $username) {\n    id\n    publicUsername\n    displayName\n    bio\n    city\n    avatarUrl\n    followerCount\n    followingCount\n    isFollowing\n    bikes {\n      make\n      model\n      year\n      nickname\n    }\n    rideStats {\n      totalRides\n      totalDistance\n      joinDate\n    }\n  }\n}": types.GetRiderProfileDocument,
    "query GetRouteReviews($routeId: ID!, $first: Int, $after: String) {\n  getRouteReviews(routeId: $routeId, first: $first, after: $after) {\n    reviews {\n      id\n      rating\n      text\n      conditionTags\n      createdAt\n      author {\n        id\n        displayName\n        publicUsername\n        avatarUrl\n      }\n      bike {\n        make\n        model\n        year\n      }\n    }\n    hasNextPage\n    endCursor\n    totalCount\n  }\n}": types.GetRouteReviewsDocument,
    "query GetTrips($first: Int, $after: String) {\n  getTrips(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        title\n        description\n        startDate\n        endDate\n        difficulty\n        maxRiders\n        participantCount\n        status\n        visibility\n        coverImageUrl\n        createdAt\n        organiser {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n        waypoints {\n          id\n          sortOrder\n          dayIndex\n          lat\n          lng\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}": types.GetTripsDocument,
    "query GroupRideDetail($groupRideId: ID!) {\n  groupRideDetail(groupRideId: $groupRideId) {\n    id\n    title\n    description\n    dateTime\n    meetingPointLat\n    meetingPointLng\n    meetingPointName\n    routeId\n    routeDescription\n    difficulty\n    maxRiders\n    participantCount\n    status\n    createdAt\n    organiser {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n    participants {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n      joinedAt\n    }\n  }\n}": types.GroupRideDetailDocument,
    "query ListPopularArticles($first: Int) {\n  popularArticles(first: $first) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    generatedAt\n    readTime\n    keywords\n  }\n}": types.ListPopularArticlesDocument,
    "query MaintenanceTaskHistory($motorcycleId: String!, $limit: Int) {\n  maintenanceTaskHistory(motorcycleId: $motorcycleId, limit: $limit) {\n    id\n    userId\n    motorcycleId\n    title\n    description\n    dueDate\n    targetMileage\n    priority\n    status\n    notes\n    partsNeeded\n    completedAt\n    completedMileage\n    source\n    oemScheduleId\n    intervalKm\n    intervalDays\n    isRecurring\n    createdAt\n    updatedAt\n  }\n}": types.MaintenanceTaskHistoryDocument,
    "query MaintenanceTasksByMotorcycle($motorcycleId: String!) {\n  maintenanceTasks(motorcycleId: $motorcycleId) {\n    id\n    userId\n    motorcycleId\n    title\n    description\n    dueDate\n    targetMileage\n    priority\n    status\n    notes\n    partsNeeded\n    completedAt\n    completedMileage\n    cost\n    partsCost\n    laborCost\n    currency\n    source\n    isRecurring\n    intervalKm\n    intervalDays\n    remind30d\n    remind7d\n    remind1d\n    photos {\n      id\n      storagePath\n      publicUrl\n    }\n    createdAt\n    updatedAt\n  }\n}": types.MaintenanceTasksByMotorcycleDocument,
    "query Me {\n  me {\n    id\n    email\n    fullName\n    role\n    preferences\n    measurementSystem\n    currency\n    publicUsername\n    displayName\n    bio\n    city\n    isPublic\n    followerCount\n    followingCount\n    avatarUrl\n    createdAt\n    updatedAt\n  }\n}": types.MeDocument,
    "query MotorcycleMakes {\n  motorcycleMakes {\n    makeId\n    makeName\n    isPopular\n  }\n}": types.MotorcycleMakesDocument,
    "query MotorcycleModels($makeId: Int!, $year: Int!) {\n  motorcycleModels(makeId: $makeId, year: $year) {\n    modelId\n    modelName\n  }\n}": types.MotorcycleModelsDocument,
    "query MotorcycleRecalls($motorcycleId: String!) {\n  motorcycleRecalls(motorcycleId: $motorcycleId) {\n    count\n    checkedAt\n    vinUsed\n    recalls {\n      campaignNumber\n      reportDate\n      component\n      summary\n      consequence\n      remedy\n    }\n  }\n}": types.MotorcycleRecallsDocument,
    "query MyDiagnostics {\n  myDiagnostics {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}": types.MyDiagnosticsDocument,
    "query GetMyHealthReports {\n  getMyHealthReports {\n    id\n    userId\n    motorcycleId\n    status\n    pdfUrl\n    iapTransactionId\n    createdAt\n    completedAt\n  }\n}": types.GetMyHealthReportsDocument,
    "query MyMotorcycles {\n  myMotorcycles {\n    id\n    userId\n    make\n    model\n    year\n    nickname\n    isPrimary\n    primaryPhotoUrl\n    currentMileage\n    mileageUnit\n    mileageUpdatedAt\n    purchasePrice\n    purchaseDate\n    type\n    engineCc\n    vin\n    recallCount\n    recallLastCheckedAt\n    odometerSyncSource\n    odometerLastRideId\n    createdAt\n  }\n}": types.MyMotorcyclesDocument,
    "query MyProgress {\n  myProgress {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}": types.MyProgressDocument,
    "query MyRides($first: Int, $after: String, $motorcycleId: String) {\n  myRides(first: $first, after: $after, motorcycleId: $motorcycleId) {\n    edges {\n      node {\n        id\n        status\n        name\n        startedAt\n        endedAt\n        distanceM\n        maxSpeedMps\n        avgSpeedMps\n        elevationGain\n        pausedDurationS\n        autoPausedDurationS\n        durationS\n        motorcycleId\n        routeThumbnailUri\n        gpsQuality\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    totalCount\n  }\n}": types.MyRidesDocument,
    "query MyShareLinks($motorcycleId: ID!) {\n  myShareLinks(motorcycleId: $motorcycleId) {\n    id\n    token\n    motorcycleId\n    expiresAt\n    createdAt\n    url\n  }\n}": types.MyShareLinksDocument,
    "query MyTrips($first: Int, $after: String) {\n  myTrips(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        title\n        description\n        startDate\n        endDate\n        difficulty\n        maxRiders\n        participantCount\n        status\n        coverImageUrl\n        createdAt\n        organiser {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}": types.MyTripsDocument,
    "query GetRideFeed($first: Int, $after: String) {\n  rideFeed(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        name\n        distanceM\n        elevationGain\n        elevationLoss\n        startedAt\n        endedAt\n        aiSummary\n        kudosCount\n        commentCount\n        hasKudos\n        routeThumbnailUri\n        rider {\n          displayName\n          avatarUrl\n          publicUsername\n        }\n        bike {\n          make\n          model\n          year\n          nickname\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n  }\n}": types.GetRideFeedDocument,
    "query RouteDetail($routeId: ID!) {\n  routeDetail(routeId: $routeId) {\n    id\n    name\n    description\n    polyline\n    distanceM\n    elevationGainM\n    surfaceType\n    curvatureIndex\n    isMotovaultPick\n    editorialDescription\n    ratingAvg\n    ratingCount\n    commentCount\n    status\n    createdAt\n    contributor {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n  }\n}": types.RouteDetailDocument,
    "query SavedRoutes($first: Int, $after: String) {\n  savedRoutes(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        name\n        polyline\n        distanceM\n        elevationGainM\n        surfaceType\n        isMotovaultPick\n        ratingAvg\n        ratingCount\n        commentCount\n        createdAt\n        startLat\n        startLng\n        contributor {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}": types.SavedRoutesDocument,
    "query SearchArticles($input: SearchArticlesInput!) {\n  searchArticles(input: $input) {\n    edges {\n      node {\n        id\n        slug\n        title\n        difficulty\n        category\n        viewCount\n        isSafetyCritical\n        generatedAt\n        updatedAt\n        keywords\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}": types.SearchArticlesDocument,
    "query SpendingSummary($motorcycleId: String!) {\n  spendingSummary(motorcycleId: $motorcycleId) {\n    thisYear\n    allTime\n  }\n}": types.SpendingSummaryDocument,
    "query TripByShareToken($shareToken: String!) {\n  tripByShareToken(shareToken: $shareToken) {\n    id\n    title\n    description\n    status\n    difficulty\n    startDate\n    endDate\n    maxRiders\n    participantCount\n    coverImageUrl\n    waypoints {\n      id\n      sortOrder\n      dayIndex\n      type\n      name\n      notes\n      lat\n      lng\n    }\n    participants {\n      anonId\n      role\n      status\n      displayName\n      avatarUrl\n    }\n  }\n}": types.TripByShareTokenDocument,
    "query TripDetail($tripId: ID!) {\n  tripDetail(tripId: $tripId) {\n    id\n    title\n    description\n    startDate\n    endDate\n    difficulty\n    maxRiders\n    participantCount\n    status\n    visibility\n    coverImageUrl\n    createdAt\n    organiser {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n    waypoints {\n      id\n      tripId\n      sortOrder\n      dayIndex\n      type\n      name\n      notes\n      lat\n      lng\n      createdAt\n    }\n    participants {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n      role\n      status\n      bikeId\n      joinedAt\n    }\n  }\n}": types.TripDetailDocument,
    "query TripInvites($tripId: ID!) {\n  tripInvites(tripId: $tripId) {\n    id\n    invitedUserId\n    invitedAt\n    acceptedAt\n    declinedAt\n  }\n}": types.TripInvitesDocument,
    "mutation JoinWaitlist($email: String!) {\n  joinWaitlist(email: $email)\n}": types.JoinWaitlistDocument,
    "query RouteBySlug($country: String!, $region: String!, $slug: String!) {\n  routeBySlug(country: $country, region: $region, slug: $slug) {\n    id\n    name\n    description\n    distanceM\n    elevationGainM\n    surfaceType\n    curvatureIndex\n    isMotovaultPick\n    editorialDescription\n    ratingAvg\n    ratingCount\n    commentCount\n    startLat\n    startLng\n    slug\n    countryCode\n    regionSlug\n    contributor {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n  }\n}": types.RouteBySlugDocument,
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
export function graphql(source: "mutation AddExpensePhoto($input: AddExpensePhotoInput!) {\n  addExpensePhoto(input: $input) {\n    id\n    expenseId\n    storagePath\n    publicUrl\n    fileSizeBytes\n    mimeType\n    createdAt\n  }\n}"): (typeof documents)["mutation AddExpensePhoto($input: AddExpensePhotoInput!) {\n  addExpensePhoto(input: $input) {\n    id\n    expenseId\n    storagePath\n    publicUrl\n    fileSizeBytes\n    mimeType\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation AddTaskPhoto($input: AddTaskPhotoInput!) {\n  addTaskPhoto(input: $input) {\n    id\n    taskId\n    storagePath\n    publicUrl\n    fileSizeBytes\n    mimeType\n    createdAt\n  }\n}"): (typeof documents)["mutation AddTaskPhoto($input: AddTaskPhotoInput!) {\n  addTaskPhoto(input: $input) {\n    id\n    taskId\n    storagePath\n    publicUrl\n    fileSizeBytes\n    mimeType\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation AddWaypoint($input: CreateWaypointInput!) {\n  addWaypoint(input: $input) {\n    id\n    tripId\n    sortOrder\n    dayIndex\n    type\n    name\n    notes\n    lat\n    lng\n    createdAt\n  }\n}"): (typeof documents)["mutation AddWaypoint($input: CreateWaypointInput!) {\n  addWaypoint(input: $input) {\n    id\n    tripId\n    sortOrder\n    dayIndex\n    type\n    name\n    notes\n    lat\n    lng\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CancelGroupRide($groupRideId: ID!) {\n  cancelGroupRide(groupRideId: $groupRideId)\n}"): (typeof documents)["mutation CancelGroupRide($groupRideId: ID!) {\n  cancelGroupRide(groupRideId: $groupRideId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CompleteMaintenanceTask($id: String!, $input: CompleteMaintenanceTaskInput, $createNextOccurrence: Boolean) {\n  completeMaintenanceTask(\n    id: $id\n    input: $input\n    createNextOccurrence: $createNextOccurrence\n  ) {\n    completed {\n      id\n      status\n      completedAt\n      completedMileage\n      cost\n      partsCost\n      laborCost\n      currency\n    }\n    nextOccurrence {\n      id\n      title\n      description\n      dueDate\n      targetMileage\n      priority\n      status\n      isRecurring\n      intervalKm\n      intervalDays\n      source\n      motorcycleId\n      createdAt\n    }\n  }\n}"): (typeof documents)["mutation CompleteMaintenanceTask($id: String!, $input: CompleteMaintenanceTaskInput, $createNextOccurrence: Boolean) {\n  completeMaintenanceTask(\n    id: $id\n    input: $input\n    createNextOccurrence: $createNextOccurrence\n  ) {\n    completed {\n      id\n      status\n      completedAt\n      completedMileage\n      cost\n      partsCost\n      laborCost\n      currency\n    }\n    nextOccurrence {\n      id\n      title\n      description\n      dueDate\n      targetMileage\n      priority\n      status\n      isRecurring\n      intervalKm\n      intervalDays\n      source\n      motorcycleId\n      createdAt\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CompleteOnboarding($input: CompleteOnboardingInput!) {\n  completeOnboarding(input: $input) {\n    id\n    preferences\n    currency\n    createdAt\n    updatedAt\n  }\n}"): (typeof documents)["mutation CompleteOnboarding($input: CompleteOnboardingInput!) {\n  completeOnboarding(input: $input) {\n    id\n    preferences\n    currency\n    createdAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateComment($input: CreateCommentInput!) {\n  createComment(input: $input) {\n    id\n    text\n    createdAt\n    flaggedCount\n    parentCommentId\n    author {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n  }\n}"): (typeof documents)["mutation CreateComment($input: CreateCommentInput!) {\n  createComment(input: $input) {\n    id\n    text\n    createdAt\n    flaggedCount\n    parentCommentId\n    author {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n  }\n}"];
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
export function graphql(source: "mutation CreateFuelLog($input: CreateFuelLogInput!) {\n  createFuelLog(input: $input) {\n    id\n    odometerKm\n    fuelLitres\n    totalCost\n    currency\n    fuelType\n    isPartial\n    filledAt\n    litresPer100Km\n    mpgUs\n  }\n}"): (typeof documents)["mutation CreateFuelLog($input: CreateFuelLogInput!) {\n  createFuelLog(input: $input) {\n    id\n    odometerKm\n    fuelLitres\n    totalCost\n    currency\n    fuelType\n    isPartial\n    filledAt\n    litresPer100Km\n    mpgUs\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateGroupRide($input: CreateGroupRideInput!) {\n  createGroupRide(input: $input) {\n    id\n    title\n  }\n}"): (typeof documents)["mutation CreateGroupRide($input: CreateGroupRideInput!) {\n  createGroupRide(input: $input) {\n    id\n    title\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateMaintenanceTask($input: CreateMaintenanceTaskInput!) {\n  createMaintenanceTask(input: $input) {\n    id\n    title\n    priority\n    status\n    dueDate\n    targetMileage\n    isRecurring\n    intervalKm\n    intervalDays\n    remind30d\n    remind7d\n    remind1d\n    createdAt\n  }\n}"): (typeof documents)["mutation CreateMaintenanceTask($input: CreateMaintenanceTaskInput!) {\n  createMaintenanceTask(input: $input) {\n    id\n    title\n    priority\n    status\n    dueDate\n    targetMileage\n    isRecurring\n    intervalKm\n    intervalDays\n    remind30d\n    remind7d\n    remind1d\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateMotorcycle($input: CreateMotorcycleInput!) {\n  createMotorcycle(input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n    isPrimary\n    createdAt\n  }\n}"): (typeof documents)["mutation CreateMotorcycle($input: CreateMotorcycleInput!) {\n  createMotorcycle(input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n    isPrimary\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateRouteReview($input: CreateRouteReviewInput!) {\n  createRouteReview(input: $input) {\n    id\n    rating\n    text\n    conditionTags\n    createdAt\n    author {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n  }\n}"): (typeof documents)["mutation CreateRouteReview($input: CreateRouteReviewInput!) {\n  createRouteReview(input: $input) {\n    id\n    rating\n    text\n    conditionTags\n    createdAt\n    author {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateShareLink($input: CreateShareLinkInput!) {\n  createShareLink(input: $input) {\n    id\n    token\n    motorcycleId\n    expiresAt\n    createdAt\n    url\n  }\n}"): (typeof documents)["mutation CreateShareLink($input: CreateShareLinkInput!) {\n  createShareLink(input: $input) {\n    id\n    token\n    motorcycleId\n    expiresAt\n    createdAt\n    url\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateTripWithWaypoints($input: CreateTripWithWaypointsInput!) {\n  createTripWithWaypoints(input: $input) {\n    id\n    title\n    description\n    startDate\n    endDate\n    difficulty\n    maxRiders\n    status\n    visibility\n    createdAt\n    organiser {\n      id\n      displayName\n    }\n    waypoints {\n      id\n      tripId\n      sortOrder\n      dayIndex\n      type\n      name\n      notes\n      lat\n      lng\n    }\n  }\n}"): (typeof documents)["mutation CreateTripWithWaypoints($input: CreateTripWithWaypointsInput!) {\n  createTripWithWaypoints(input: $input) {\n    id\n    title\n    description\n    startDate\n    endDate\n    difficulty\n    maxRiders\n    status\n    visibility\n    createdAt\n    organiser {\n      id\n      displayName\n    }\n    waypoints {\n      id\n      tripId\n      sortOrder\n      dayIndex\n      type\n      name\n      notes\n      lat\n      lng\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateTrip($input: CreateTripInput!) {\n  createTrip(input: $input) {\n    id\n    title\n    description\n    startDate\n    endDate\n    difficulty\n    maxRiders\n    status\n    createdAt\n    organiser {\n      id\n      displayName\n    }\n  }\n}"): (typeof documents)["mutation CreateTrip($input: CreateTripInput!) {\n  createTrip(input: $input) {\n    id\n    title\n    description\n    startDate\n    endDate\n    difficulty\n    maxRiders\n    status\n    createdAt\n    organiser {\n      id\n      displayName\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation DeleteAccount {\n  deleteAccount\n}"): (typeof documents)["mutation DeleteAccount {\n  deleteAccount\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation DeleteComment($commentId: ID!) {\n  deleteComment(commentId: $commentId)\n}"): (typeof documents)["mutation DeleteComment($commentId: ID!) {\n  deleteComment(commentId: $commentId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation DeleteExpensePhoto($photoId: String!) {\n  deleteExpensePhoto(photoId: $photoId)\n}"): (typeof documents)["mutation DeleteExpensePhoto($photoId: String!) {\n  deleteExpensePhoto(photoId: $photoId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation DeleteExpense($id: String!) {\n  deleteExpense(id: $id)\n}"): (typeof documents)["mutation DeleteExpense($id: String!) {\n  deleteExpense(id: $id)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation DeleteFuelLog($id: String!) {\n  deleteFuelLog(id: $id)\n}"): (typeof documents)["mutation DeleteFuelLog($id: String!) {\n  deleteFuelLog(id: $id)\n}"];
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
export function graphql(source: "mutation DeleteRide($id: String!) {\n  deleteRide(id: $id)\n}"): (typeof documents)["mutation DeleteRide($id: String!) {\n  deleteRide(id: $id)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation DeleteTaskPhoto($photoId: ID!) {\n  deleteTaskPhoto(photoId: $photoId)\n}"): (typeof documents)["mutation DeleteTaskPhoto($photoId: ID!) {\n  deleteTaskPhoto(photoId: $photoId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation DeleteTrip($tripId: ID!) {\n  deleteTrip(tripId: $tripId)\n}"): (typeof documents)["mutation DeleteTrip($tripId: ID!) {\n  deleteTrip(tripId: $tripId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation EndRide($input: EndRideInput!) {\n  endRide(input: $input) {\n    ride {\n      id\n      status\n      endedAt\n      distanceM\n      maxSpeedMps\n      avgSpeedMps\n      elevationGain\n      elevationLoss\n      pausedDurationS\n      autoPausedDurationS\n      gpsQuality\n      routePolyline\n      mileageApplied\n    }\n    triggeredMaintenanceTasks {\n      id\n      title\n      priority\n    }\n  }\n}"): (typeof documents)["mutation EndRide($input: EndRideInput!) {\n  endRide(input: $input) {\n    ride {\n      id\n      status\n      endedAt\n      distanceM\n      maxSpeedMps\n      avgSpeedMps\n      elevationGain\n      elevationLoss\n      pausedDurationS\n      autoPausedDurationS\n      gpsQuality\n      routePolyline\n      mileageApplied\n    }\n    triggeredMaintenanceTasks {\n      id\n      title\n      priority\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation FlagComment($commentId: ID!) {\n  flagComment(commentId: $commentId)\n}"): (typeof documents)["mutation FlagComment($commentId: ID!) {\n  flagComment(commentId: $commentId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation FollowRider($input: FollowRiderInput!) {\n  followRider(input: $input) {\n    followerId\n    followingId\n    createdAt\n  }\n}"): (typeof documents)["mutation FollowRider($input: FollowRiderInput!) {\n  followRider(input: $input) {\n    followerId\n    followingId\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation GenerateArticle($input: GenerateArticleInput!) {\n  generateArticle(input: $input) {\n    id\n    slug\n    title\n    difficulty\n    category\n    contentJson\n    readTime\n    generatedAt\n  }\n}"): (typeof documents)["mutation GenerateArticle($input: GenerateArticleInput!) {\n  generateArticle(input: $input) {\n    id\n    slug\n    title\n    difficulty\n    category\n    contentJson\n    readTime\n    generatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation GenerateBikeHealthReport($input: GenerateReportInput!) {\n  generateBikeHealthReport(input: $input) {\n    id\n    userId\n    motorcycleId\n    status\n    pdfUrl\n    iapTransactionId\n    createdAt\n    completedAt\n  }\n}"): (typeof documents)["mutation GenerateBikeHealthReport($input: GenerateReportInput!) {\n  generateBikeHealthReport(input: $input) {\n    id\n    userId\n    motorcycleId\n    status\n    pdfUrl\n    iapTransactionId\n    createdAt\n    completedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation GenerateOnboardingInsights($input: GenerateInsightsInput!) {\n  generateOnboardingInsights(input: $input) {\n    icon\n    title\n    body\n    type\n  }\n}"): (typeof documents)["mutation GenerateOnboardingInsights($input: GenerateInsightsInput!) {\n  generateOnboardingInsights(input: $input) {\n    icon\n    title\n    body\n    type\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation ImportOemSchedule($motorcycleId: String!) {\n  importOemSchedule(motorcycleId: $motorcycleId)\n}"): (typeof documents)["mutation ImportOemSchedule($motorcycleId: String!) {\n  importOemSchedule(motorcycleId: $motorcycleId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation InviteToTrip($tripId: ID!, $invitedUserId: ID!) {\n  inviteToTrip(tripId: $tripId, invitedUserId: $invitedUserId)\n}"): (typeof documents)["mutation InviteToTrip($tripId: ID!, $invitedUserId: ID!) {\n  inviteToTrip(tripId: $tripId, invitedUserId: $invitedUserId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation JoinGroupRide($groupRideId: ID!) {\n  joinGroupRide(groupRideId: $groupRideId)\n}"): (typeof documents)["mutation JoinGroupRide($groupRideId: ID!) {\n  joinGroupRide(groupRideId: $groupRideId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation JoinPremiumWaitlist($feature: String!) {\n  joinPremiumWaitlist(feature: $feature)\n}"): (typeof documents)["mutation JoinPremiumWaitlist($feature: String!) {\n  joinPremiumWaitlist(feature: $feature)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation JoinTrip($input: JoinTripInput!) {\n  joinTrip(input: $input)\n}"): (typeof documents)["mutation JoinTrip($input: JoinTripInput!) {\n  joinTrip(input: $input)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation LeaveGroupRide($groupRideId: ID!) {\n  leaveGroupRide(groupRideId: $groupRideId)\n}"): (typeof documents)["mutation LeaveGroupRide($groupRideId: ID!) {\n  leaveGroupRide(groupRideId: $groupRideId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation LeaveTrip($tripId: ID!) {\n  leaveTrip(tripId: $tripId)\n}"): (typeof documents)["mutation LeaveTrip($tripId: ID!) {\n  leaveTrip(tripId: $tripId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation LogExpense($input: LogExpenseInput!) {\n  logExpense(input: $input) {\n    id\n    amount\n    category\n    currency\n    description\n    date\n    createdAt\n  }\n}"): (typeof documents)["mutation LogExpense($input: LogExpenseInput!) {\n  logExpense(input: $input) {\n    id\n    amount\n    category\n    currency\n    description\n    date\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation MarkArticleRead($articleId: String!) {\n  markArticleRead(articleId: $articleId) {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}"): (typeof documents)["mutation MarkArticleRead($articleId: String!) {\n  markArticleRead(articleId: $articleId) {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation PublishTrip($tripId: ID!) {\n  publishTrip(tripId: $tripId) {\n    id\n    status\n  }\n}"): (typeof documents)["mutation PublishTrip($tripId: ID!) {\n  publishTrip(tripId: $tripId) {\n    id\n    status\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation RegenerateRideSummary($rideId: String!) {\n  regenerateRideSummary(rideId: $rideId) {\n    id\n    rideId\n    summaryText\n    generationStatus\n    locale\n    createdAt\n    updatedAt\n  }\n}"): (typeof documents)["mutation RegenerateRideSummary($rideId: String!) {\n  regenerateRideSummary(rideId: $rideId) {\n    id\n    rideId\n    summaryText\n    generationStatus\n    locale\n    createdAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation RemoveWaypoint($waypointId: ID!) {\n  removeWaypoint(waypointId: $waypointId)\n}"): (typeof documents)["mutation RemoveWaypoint($waypointId: ID!) {\n  removeWaypoint(waypointId: $waypointId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation ReorderWaypoints($input: ReorderWaypointsInput!) {\n  reorderWaypoints(input: $input)\n}"): (typeof documents)["mutation ReorderWaypoints($input: ReorderWaypointsInput!) {\n  reorderWaypoints(input: $input)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation RequestDataExport {\n  requestDataExport {\n    id\n    status\n    requestedAt\n  }\n}"): (typeof documents)["mutation RequestDataExport {\n  requestDataExport {\n    id\n    status\n    requestedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation RespondToTripInvite($inviteId: ID!, $accept: Boolean!) {\n  respondToTripInvite(inviteId: $inviteId, accept: $accept)\n}"): (typeof documents)["mutation RespondToTripInvite($inviteId: ID!, $accept: Boolean!) {\n  respondToTripInvite(inviteId: $inviteId, accept: $accept)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation RevokeShareLink($linkId: ID!) {\n  revokeShareLink(linkId: $linkId)\n}"): (typeof documents)["mutation RevokeShareLink($linkId: ID!) {\n  revokeShareLink(linkId: $linkId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation RotateTripShareToken($tripId: ID!) {\n  rotateTripShareToken(tripId: $tripId)\n}"): (typeof documents)["mutation RotateTripShareToken($tripId: ID!) {\n  rotateTripShareToken(tripId: $tripId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation SaveRoute($routeId: ID!) {\n  saveRoute(routeId: $routeId)\n}"): (typeof documents)["mutation SaveRoute($routeId: ID!) {\n  saveRoute(routeId: $routeId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation ShareRideToDiscover($input: ShareRideToDiscoverInput!) {\n  shareRideToDiscover(input: $input) {\n    id\n    name\n    distanceM\n  }\n}"): (typeof documents)["mutation ShareRideToDiscover($input: ShareRideToDiscoverInput!) {\n  shareRideToDiscover(input: $input) {\n    id\n    name\n    distanceM\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation ShareRide($rideId: String!, $sharedWithUserId: String!) {\n  shareRide(rideId: $rideId, sharedWithUserId: $sharedWithUserId)\n}"): (typeof documents)["mutation ShareRide($rideId: String!, $sharedWithUserId: String!) {\n  shareRide(rideId: $rideId, sharedWithUserId: $sharedWithUserId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation StartRide($input: StartRideInput!) {\n  startRide(input: $input) {\n    id\n    status\n    startedAt\n    motorcycleId\n  }\n}"): (typeof documents)["mutation StartRide($input: StartRideInput!) {\n  startRide(input: $input) {\n    id\n    status\n    startedAt\n    motorcycleId\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation SubmitDiagnostic($input: SubmitDiagnosticInput!) {\n  submitDiagnostic(input: $input) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    resultJson\n    description\n    photoUrl\n    status\n    createdAt\n  }\n}"): (typeof documents)["mutation SubmitDiagnostic($input: SubmitDiagnosticInput!) {\n  submitDiagnostic(input: $input) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    resultJson\n    description\n    photoUrl\n    status\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation ToggleKudos($rideId: String!) {\n  toggleKudos(rideId: $rideId) {\n    hasKudos\n    kudosCount\n  }\n}"): (typeof documents)["mutation ToggleKudos($rideId: String!) {\n  toggleKudos(rideId: $rideId) {\n    hasKudos\n    kudosCount\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation TrackAffiliateClick($input: TrackClickInput!) {\n  trackAffiliateClick(input: $input) {\n    partner\n    affiliateUrl\n    productUrl\n    tracked\n  }\n}"): (typeof documents)["mutation TrackAffiliateClick($input: TrackClickInput!) {\n  trackAffiliateClick(input: $input) {\n    partner\n    affiliateUrl\n    productUrl\n    tracked\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UnfollowRider($input: UnfollowRiderInput!) {\n  unfollowRider(input: $input)\n}"): (typeof documents)["mutation UnfollowRider($input: UnfollowRiderInput!) {\n  unfollowRider(input: $input)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UnsaveRoute($routeId: ID!) {\n  unsaveRoute(routeId: $routeId)\n}"): (typeof documents)["mutation UnsaveRoute($routeId: ID!) {\n  unsaveRoute(routeId: $routeId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UnshareRide($rideId: String!, $sharedWithUserId: String!) {\n  unshareRide(rideId: $rideId, sharedWithUserId: $sharedWithUserId)\n}"): (typeof documents)["mutation UnshareRide($rideId: String!, $sharedWithUserId: String!) {\n  unshareRide(rideId: $rideId, sharedWithUserId: $sharedWithUserId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UnshareRoute($routeId: ID!) {\n  unshareRoute(routeId: $routeId)\n}"): (typeof documents)["mutation UnshareRoute($routeId: ID!) {\n  unshareRoute(routeId: $routeId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateMotorcycle($id: String!, $input: UpdateMotorcycleInput!) {\n  updateMotorcycle(id: $id, input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n    isPrimary\n    primaryPhotoUrl\n    currentMileage\n    mileageUnit\n    mileageUpdatedAt\n    purchasePrice\n    purchaseDate\n    vin\n    recallCount\n    recallLastCheckedAt\n  }\n}"): (typeof documents)["mutation UpdateMotorcycle($id: String!, $input: UpdateMotorcycleInput!) {\n  updateMotorcycle(id: $id, input: $input) {\n    id\n    make\n    model\n    year\n    nickname\n    isPrimary\n    primaryPhotoUrl\n    currentMileage\n    mileageUnit\n    mileageUpdatedAt\n    purchasePrice\n    purchaseDate\n    vin\n    recallCount\n    recallLastCheckedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateMyProfile($input: UpdateProfileInput!) {\n  updateMyProfile(input: $input) {\n    id\n    fullName\n    publicUsername\n    displayName\n    bio\n    city\n    isPublic\n    followerCount\n    followingCount\n  }\n}"): (typeof documents)["mutation UpdateMyProfile($input: UpdateProfileInput!) {\n  updateMyProfile(input: $input) {\n    id\n    fullName\n    publicUsername\n    displayName\n    bio\n    city\n    isPublic\n    followerCount\n    followingCount\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateParticipantStatus($input: UpdateParticipantStatusInput!) {\n  updateParticipantStatus(input: $input)\n}"): (typeof documents)["mutation UpdateParticipantStatus($input: UpdateParticipantStatusInput!) {\n  updateParticipantStatus(input: $input)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateRideVisibility($rideId: String!, $visibility: String!) {\n  updateRideVisibility(rideId: $rideId, visibility: $visibility) {\n    id\n    visibility\n    isPublic\n  }\n}"): (typeof documents)["mutation UpdateRideVisibility($rideId: String!, $visibility: String!) {\n  updateRideVisibility(rideId: $rideId, visibility: $visibility) {\n    id\n    visibility\n    isPublic\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateRide($input: UpdateRideInput!) {\n  updateRide(input: $input) {\n    id\n    name\n    mileageApplied\n    isPublic\n  }\n}"): (typeof documents)["mutation UpdateRide($input: UpdateRideInput!) {\n  updateRide(input: $input) {\n    id\n    name\n    mileageApplied\n    isPublic\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateTrip($input: UpdateTripInput!) {\n  updateTrip(input: $input) {\n    id\n    title\n    description\n    startDate\n    endDate\n    difficulty\n    maxRiders\n    status\n    visibility\n    waypoints {\n      id\n      tripId\n      sortOrder\n      dayIndex\n      type\n      name\n      notes\n      lat\n      lng\n    }\n  }\n}"): (typeof documents)["mutation UpdateTrip($input: UpdateTripInput!) {\n  updateTrip(input: $input) {\n    id\n    title\n    description\n    startDate\n    endDate\n    difficulty\n    maxRiders\n    status\n    visibility\n    waypoints {\n      id\n      tripId\n      sortOrder\n      dayIndex\n      type\n      name\n      notes\n      lat\n      lng\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateUser($input: UpdateUserInput!) {\n  updateUser(input: $input) {\n    id\n    fullName\n    preferences\n    measurementSystem\n    currency\n  }\n}"): (typeof documents)["mutation UpdateUser($input: UpdateUserInput!) {\n  updateUser(input: $input) {\n    id\n    fullName\n    preferences\n    measurementSystem\n    currency\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateWaypoint($input: UpdateWaypointInput!) {\n  updateWaypoint(input: $input) {\n    id\n    sortOrder\n    dayIndex\n    type\n    name\n    notes\n    lat\n    lng\n  }\n}"): (typeof documents)["mutation UpdateWaypoint($input: UpdateWaypointInput!) {\n  updateWaypoint(input: $input) {\n    id\n    sortOrder\n    dayIndex\n    type\n    name\n    notes\n    lat\n    lng\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UploadWaypoints($input: UploadWaypointsInput!) {\n  uploadWaypoints(input: $input)\n}"): (typeof documents)["mutation UploadWaypoints($input: UploadWaypointsInput!) {\n  uploadWaypoints(input: $input)\n}"];
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
export function graphql(source: "query DiagnosticById($id: String!) {\n  diagnosticById(id: $id) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    resultJson\n    description\n    photoUrl\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}"): (typeof documents)["query DiagnosticById($id: String!) {\n  diagnosticById(id: $id) {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    resultJson\n    description\n    photoUrl\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query DiscoverRoutes($filter: DiscoverRoutesFilterInput, $first: Int, $after: String) {\n  discoverRoutes(filter: $filter, first: $first, after: $after) {\n    edges {\n      node {\n        id\n        name\n        polyline\n        distanceM\n        elevationGainM\n        surfaceType\n        curvatureIndex\n        isMotovaultPick\n        editorialDescription\n        ratingAvg\n        ratingCount\n        commentCount\n        createdAt\n        startLat\n        startLng\n        contributor {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}"): (typeof documents)["query DiscoverRoutes($filter: DiscoverRoutesFilterInput, $first: Int, $after: String) {\n  discoverRoutes(filter: $filter, first: $first, after: $after) {\n    edges {\n      node {\n        id\n        name\n        polyline\n        distanceM\n        elevationGainM\n        surfaceType\n        curvatureIndex\n        isMotovaultPick\n        editorialDescription\n        ratingAvg\n        ratingCount\n        commentCount\n        createdAt\n        startLat\n        startLng\n        contributor {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query ExpenseDashboard($motorcycleId: String!) {\n  expenseDashboard(motorcycleId: $motorcycleId) {\n    currentYearTotal\n    previousYearTotal\n    allTimeTotal\n    expenseCount\n    monthlyBuckets {\n      month\n      year\n      fuel\n      maintenance\n      parts\n      gear\n      tires\n      insurance\n      registration\n      tolls\n      parking\n      modifications\n      training\n      total\n    }\n    categoryTotals {\n      category\n      total\n    }\n  }\n}"): (typeof documents)["query ExpenseDashboard($motorcycleId: String!) {\n  expenseDashboard(motorcycleId: $motorcycleId) {\n    currentYearTotal\n    previousYearTotal\n    allTimeTotal\n    expenseCount\n    monthlyBuckets {\n      month\n      year\n      fuel\n      maintenance\n      parts\n      gear\n      tires\n      insurance\n      registration\n      tolls\n      parking\n      modifications\n      training\n      total\n    }\n    categoryTotals {\n      category\n      total\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query ExpensePhotos($expenseId: String!) {\n  expensePhotos(expenseId: $expenseId) {\n    id\n    expenseId\n    storagePath\n    publicUrl\n    fileSizeBytes\n    mimeType\n    createdAt\n  }\n}"): (typeof documents)["query ExpensePhotos($expenseId: String!) {\n  expensePhotos(expenseId: $expenseId) {\n    id\n    expenseId\n    storagePath\n    publicUrl\n    fileSizeBytes\n    mimeType\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query ExpensesByMotorcycle($motorcycleId: String!, $year: Int!) {\n  expenses(motorcycleId: $motorcycleId, year: $year) {\n    ytdTotal\n    categories {\n      category\n      total\n      expenses {\n        id\n        amount\n        category\n        currency\n        description\n        date\n        createdAt\n      }\n    }\n  }\n}"): (typeof documents)["query ExpensesByMotorcycle($motorcycleId: String!, $year: Int!) {\n  expenses(motorcycleId: $motorcycleId, year: $year) {\n    ytdTotal\n    categories {\n      category\n      total\n      expenses {\n        id\n        amount\n        category\n        currency\n        description\n        date\n        createdAt\n      }\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query FuelLogs($motorcycleId: String!) {\n  fuelLogs(motorcycleId: $motorcycleId) {\n    id\n    motorcycleId\n    odometerKm\n    fuelLitres\n    totalCost\n    currency\n    fuelType\n    isPartial\n    notes\n    filledAt\n    kmSincePrevious\n    litresPer100Km\n    mpgUs\n  }\n}"): (typeof documents)["query FuelLogs($motorcycleId: String!) {\n  fuelLogs(motorcycleId: $motorcycleId) {\n    id\n    motorcycleId\n    odometerKm\n    fuelLitres\n    totalCost\n    currency\n    fuelType\n    isPartial\n    notes\n    filledAt\n    kmSincePrevious\n    litresPer100Km\n    mpgUs\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetArticleBySlug($slug: String!) {\n  articleBySlug(slug: $slug) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    generatedAt\n    updatedAt\n  }\n}"): (typeof documents)["query GetArticleBySlug($slug: String!) {\n  articleBySlug(slug: $slug) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    generatedAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetComments($rideId: ID, $routeId: ID, $groupRideId: ID, $tripId: ID, $first: Int, $after: String) {\n  getComments(\n    rideId: $rideId\n    routeId: $routeId\n    groupRideId: $groupRideId\n    tripId: $tripId\n    first: $first\n    after: $after\n  ) {\n    comments {\n      id\n      text\n      createdAt\n      flaggedCount\n      parentCommentId\n      author {\n        id\n        displayName\n        publicUsername\n        avatarUrl\n      }\n      replies {\n        id\n        text\n        createdAt\n        flaggedCount\n        parentCommentId\n        author {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n    }\n    hasNextPage\n    endCursor\n    totalCount\n  }\n}"): (typeof documents)["query GetComments($rideId: ID, $routeId: ID, $groupRideId: ID, $tripId: ID, $first: Int, $after: String) {\n  getComments(\n    rideId: $rideId\n    routeId: $routeId\n    groupRideId: $groupRideId\n    tripId: $tripId\n    first: $first\n    after: $after\n  ) {\n    comments {\n      id\n      text\n      createdAt\n      flaggedCount\n      parentCommentId\n      author {\n        id\n        displayName\n        publicUsername\n        avatarUrl\n      }\n      replies {\n        id\n        text\n        createdAt\n        flaggedCount\n        parentCommentId\n        author {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n    }\n    hasNextPage\n    endCursor\n    totalCount\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetFollowers($userId: String!, $first: Int, $after: String) {\n  getFollowers(userId: $userId, first: $first, after: $after) {\n    edges {\n      node {\n        followerId\n        followingId\n        createdAt\n        displayName\n        publicUsername\n        avatarUrl\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}"): (typeof documents)["query GetFollowers($userId: String!, $first: Int, $after: String) {\n  getFollowers(userId: $userId, first: $first, after: $after) {\n    edges {\n      node {\n        followerId\n        followingId\n        createdAt\n        displayName\n        publicUsername\n        avatarUrl\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetFollowing($userId: String!, $first: Int, $after: String) {\n  getFollowing(userId: $userId, first: $first, after: $after) {\n    edges {\n      node {\n        followerId\n        followingId\n        createdAt\n        displayName\n        publicUsername\n        avatarUrl\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}"): (typeof documents)["query GetFollowing($userId: String!, $first: Int, $after: String) {\n  getFollowing(userId: $userId, first: $first, after: $after) {\n    edges {\n      node {\n        followerId\n        followingId\n        createdAt\n        displayName\n        publicUsername\n        avatarUrl\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetGroupRides($first: Int, $after: String) {\n  getGroupRides(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        title\n        description\n        dateTime\n        meetingPointLat\n        meetingPointLng\n        meetingPointName\n        routeId\n        difficulty\n        maxRiders\n        participantCount\n        status\n        createdAt\n        organiser {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}"): (typeof documents)["query GetGroupRides($first: Int, $after: String) {\n  getGroupRides(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        title\n        description\n        dateTime\n        meetingPointLat\n        meetingPointLng\n        meetingPointName\n        routeId\n        difficulty\n        maxRiders\n        participantCount\n        status\n        createdAt\n        organiser {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetKudosList($rideId: String!, $first: Int, $after: String) {\n  kudosList(rideId: $rideId, first: $first, after: $after) {\n    id\n    displayName\n    avatarUrl\n    publicUsername\n  }\n}"): (typeof documents)["query GetKudosList($rideId: String!, $first: Int, $after: String) {\n  kudosList(rideId: $rideId, first: $first, after: $after) {\n    id\n    displayName\n    avatarUrl\n    publicUsername\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetRideWaypoints($rideId: String!, $maxPoints: Int) {\n  rideWaypoints(rideId: $rideId, maxPoints: $maxPoints) {\n    recordedAt\n    latitude\n    longitude\n    altitude\n    speedMps\n  }\n}"): (typeof documents)["query GetRideWaypoints($rideId: String!, $maxPoints: Int) {\n  rideWaypoints(rideId: $rideId, maxPoints: $maxPoints) {\n    recordedAt\n    latitude\n    longitude\n    altitude\n    speedMps\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetRide($id: String!) {\n  ride(id: $id) {\n    id\n    status\n    name\n    startedAt\n    endedAt\n    distanceM\n    maxSpeedMps\n    avgSpeedMps\n    elevationGain\n    elevationLoss\n    pausedDurationS\n    autoPausedDurationS\n    durationS\n    motorcycleId\n    routePolyline\n    routeThumbnailUri\n    gpsQuality\n    mileageApplied\n    isPublic\n    createdAt\n  }\n}"): (typeof documents)["query GetRide($id: String!) {\n  ride(id: $id) {\n    id\n    status\n    name\n    startedAt\n    endedAt\n    distanceM\n    maxSpeedMps\n    avgSpeedMps\n    elevationGain\n    elevationLoss\n    pausedDurationS\n    autoPausedDurationS\n    durationS\n    motorcycleId\n    routePolyline\n    routeThumbnailUri\n    gpsQuality\n    mileageApplied\n    isPublic\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetRiderProfile($username: String!) {\n  getRiderProfile(username: $username) {\n    id\n    publicUsername\n    displayName\n    bio\n    city\n    avatarUrl\n    followerCount\n    followingCount\n    isFollowing\n    bikes {\n      make\n      model\n      year\n      nickname\n    }\n    rideStats {\n      totalRides\n      totalDistance\n      joinDate\n    }\n  }\n}"): (typeof documents)["query GetRiderProfile($username: String!) {\n  getRiderProfile(username: $username) {\n    id\n    publicUsername\n    displayName\n    bio\n    city\n    avatarUrl\n    followerCount\n    followingCount\n    isFollowing\n    bikes {\n      make\n      model\n      year\n      nickname\n    }\n    rideStats {\n      totalRides\n      totalDistance\n      joinDate\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetRouteReviews($routeId: ID!, $first: Int, $after: String) {\n  getRouteReviews(routeId: $routeId, first: $first, after: $after) {\n    reviews {\n      id\n      rating\n      text\n      conditionTags\n      createdAt\n      author {\n        id\n        displayName\n        publicUsername\n        avatarUrl\n      }\n      bike {\n        make\n        model\n        year\n      }\n    }\n    hasNextPage\n    endCursor\n    totalCount\n  }\n}"): (typeof documents)["query GetRouteReviews($routeId: ID!, $first: Int, $after: String) {\n  getRouteReviews(routeId: $routeId, first: $first, after: $after) {\n    reviews {\n      id\n      rating\n      text\n      conditionTags\n      createdAt\n      author {\n        id\n        displayName\n        publicUsername\n        avatarUrl\n      }\n      bike {\n        make\n        model\n        year\n      }\n    }\n    hasNextPage\n    endCursor\n    totalCount\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetTrips($first: Int, $after: String) {\n  getTrips(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        title\n        description\n        startDate\n        endDate\n        difficulty\n        maxRiders\n        participantCount\n        status\n        visibility\n        coverImageUrl\n        createdAt\n        organiser {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n        waypoints {\n          id\n          sortOrder\n          dayIndex\n          lat\n          lng\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}"): (typeof documents)["query GetTrips($first: Int, $after: String) {\n  getTrips(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        title\n        description\n        startDate\n        endDate\n        difficulty\n        maxRiders\n        participantCount\n        status\n        visibility\n        coverImageUrl\n        createdAt\n        organiser {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n        waypoints {\n          id\n          sortOrder\n          dayIndex\n          lat\n          lng\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GroupRideDetail($groupRideId: ID!) {\n  groupRideDetail(groupRideId: $groupRideId) {\n    id\n    title\n    description\n    dateTime\n    meetingPointLat\n    meetingPointLng\n    meetingPointName\n    routeId\n    routeDescription\n    difficulty\n    maxRiders\n    participantCount\n    status\n    createdAt\n    organiser {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n    participants {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n      joinedAt\n    }\n  }\n}"): (typeof documents)["query GroupRideDetail($groupRideId: ID!) {\n  groupRideDetail(groupRideId: $groupRideId) {\n    id\n    title\n    description\n    dateTime\n    meetingPointLat\n    meetingPointLng\n    meetingPointName\n    routeId\n    routeDescription\n    difficulty\n    maxRiders\n    participantCount\n    status\n    createdAt\n    organiser {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n    participants {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n      joinedAt\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query ListPopularArticles($first: Int) {\n  popularArticles(first: $first) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    generatedAt\n    readTime\n    keywords\n  }\n}"): (typeof documents)["query ListPopularArticles($first: Int) {\n  popularArticles(first: $first) {\n    id\n    slug\n    title\n    difficulty\n    category\n    viewCount\n    isSafetyCritical\n    generatedAt\n    readTime\n    keywords\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MaintenanceTaskHistory($motorcycleId: String!, $limit: Int) {\n  maintenanceTaskHistory(motorcycleId: $motorcycleId, limit: $limit) {\n    id\n    userId\n    motorcycleId\n    title\n    description\n    dueDate\n    targetMileage\n    priority\n    status\n    notes\n    partsNeeded\n    completedAt\n    completedMileage\n    source\n    oemScheduleId\n    intervalKm\n    intervalDays\n    isRecurring\n    createdAt\n    updatedAt\n  }\n}"): (typeof documents)["query MaintenanceTaskHistory($motorcycleId: String!, $limit: Int) {\n  maintenanceTaskHistory(motorcycleId: $motorcycleId, limit: $limit) {\n    id\n    userId\n    motorcycleId\n    title\n    description\n    dueDate\n    targetMileage\n    priority\n    status\n    notes\n    partsNeeded\n    completedAt\n    completedMileage\n    source\n    oemScheduleId\n    intervalKm\n    intervalDays\n    isRecurring\n    createdAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MaintenanceTasksByMotorcycle($motorcycleId: String!) {\n  maintenanceTasks(motorcycleId: $motorcycleId) {\n    id\n    userId\n    motorcycleId\n    title\n    description\n    dueDate\n    targetMileage\n    priority\n    status\n    notes\n    partsNeeded\n    completedAt\n    completedMileage\n    cost\n    partsCost\n    laborCost\n    currency\n    source\n    isRecurring\n    intervalKm\n    intervalDays\n    remind30d\n    remind7d\n    remind1d\n    photos {\n      id\n      storagePath\n      publicUrl\n    }\n    createdAt\n    updatedAt\n  }\n}"): (typeof documents)["query MaintenanceTasksByMotorcycle($motorcycleId: String!) {\n  maintenanceTasks(motorcycleId: $motorcycleId) {\n    id\n    userId\n    motorcycleId\n    title\n    description\n    dueDate\n    targetMileage\n    priority\n    status\n    notes\n    partsNeeded\n    completedAt\n    completedMileage\n    cost\n    partsCost\n    laborCost\n    currency\n    source\n    isRecurring\n    intervalKm\n    intervalDays\n    remind30d\n    remind7d\n    remind1d\n    photos {\n      id\n      storagePath\n      publicUrl\n    }\n    createdAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query Me {\n  me {\n    id\n    email\n    fullName\n    role\n    preferences\n    measurementSystem\n    currency\n    publicUsername\n    displayName\n    bio\n    city\n    isPublic\n    followerCount\n    followingCount\n    avatarUrl\n    createdAt\n    updatedAt\n  }\n}"): (typeof documents)["query Me {\n  me {\n    id\n    email\n    fullName\n    role\n    preferences\n    measurementSystem\n    currency\n    publicUsername\n    displayName\n    bio\n    city\n    isPublic\n    followerCount\n    followingCount\n    avatarUrl\n    createdAt\n    updatedAt\n  }\n}"];
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
export function graphql(source: "query MotorcycleRecalls($motorcycleId: String!) {\n  motorcycleRecalls(motorcycleId: $motorcycleId) {\n    count\n    checkedAt\n    vinUsed\n    recalls {\n      campaignNumber\n      reportDate\n      component\n      summary\n      consequence\n      remedy\n    }\n  }\n}"): (typeof documents)["query MotorcycleRecalls($motorcycleId: String!) {\n  motorcycleRecalls(motorcycleId: $motorcycleId) {\n    count\n    checkedAt\n    vinUsed\n    recalls {\n      campaignNumber\n      reportDate\n      component\n      summary\n      consequence\n      remedy\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MyDiagnostics {\n  myDiagnostics {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}"): (typeof documents)["query MyDiagnostics {\n  myDiagnostics {\n    id\n    userId\n    motorcycleId\n    severity\n    confidence\n    relatedArticleId\n    status\n    dataSharingOptedIn\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetMyHealthReports {\n  getMyHealthReports {\n    id\n    userId\n    motorcycleId\n    status\n    pdfUrl\n    iapTransactionId\n    createdAt\n    completedAt\n  }\n}"): (typeof documents)["query GetMyHealthReports {\n  getMyHealthReports {\n    id\n    userId\n    motorcycleId\n    status\n    pdfUrl\n    iapTransactionId\n    createdAt\n    completedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MyMotorcycles {\n  myMotorcycles {\n    id\n    userId\n    make\n    model\n    year\n    nickname\n    isPrimary\n    primaryPhotoUrl\n    currentMileage\n    mileageUnit\n    mileageUpdatedAt\n    purchasePrice\n    purchaseDate\n    type\n    engineCc\n    vin\n    recallCount\n    recallLastCheckedAt\n    odometerSyncSource\n    odometerLastRideId\n    createdAt\n  }\n}"): (typeof documents)["query MyMotorcycles {\n  myMotorcycles {\n    id\n    userId\n    make\n    model\n    year\n    nickname\n    isPrimary\n    primaryPhotoUrl\n    currentMileage\n    mileageUnit\n    mileageUpdatedAt\n    purchasePrice\n    purchaseDate\n    type\n    engineCc\n    vin\n    recallCount\n    recallLastCheckedAt\n    odometerSyncSource\n    odometerLastRideId\n    createdAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MyProgress {\n  myProgress {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}"): (typeof documents)["query MyProgress {\n  myProgress {\n    id\n    userId\n    articleId\n    articleRead\n    quizCompleted\n    quizBestScore\n    firstReadAt\n    lastReadAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MyRides($first: Int, $after: String, $motorcycleId: String) {\n  myRides(first: $first, after: $after, motorcycleId: $motorcycleId) {\n    edges {\n      node {\n        id\n        status\n        name\n        startedAt\n        endedAt\n        distanceM\n        maxSpeedMps\n        avgSpeedMps\n        elevationGain\n        pausedDurationS\n        autoPausedDurationS\n        durationS\n        motorcycleId\n        routeThumbnailUri\n        gpsQuality\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    totalCount\n  }\n}"): (typeof documents)["query MyRides($first: Int, $after: String, $motorcycleId: String) {\n  myRides(first: $first, after: $after, motorcycleId: $motorcycleId) {\n    edges {\n      node {\n        id\n        status\n        name\n        startedAt\n        endedAt\n        distanceM\n        maxSpeedMps\n        avgSpeedMps\n        elevationGain\n        pausedDurationS\n        autoPausedDurationS\n        durationS\n        motorcycleId\n        routeThumbnailUri\n        gpsQuality\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    totalCount\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MyShareLinks($motorcycleId: ID!) {\n  myShareLinks(motorcycleId: $motorcycleId) {\n    id\n    token\n    motorcycleId\n    expiresAt\n    createdAt\n    url\n  }\n}"): (typeof documents)["query MyShareLinks($motorcycleId: ID!) {\n  myShareLinks(motorcycleId: $motorcycleId) {\n    id\n    token\n    motorcycleId\n    expiresAt\n    createdAt\n    url\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MyTrips($first: Int, $after: String) {\n  myTrips(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        title\n        description\n        startDate\n        endDate\n        difficulty\n        maxRiders\n        participantCount\n        status\n        coverImageUrl\n        createdAt\n        organiser {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}"): (typeof documents)["query MyTrips($first: Int, $after: String) {\n  myTrips(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        title\n        description\n        startDate\n        endDate\n        difficulty\n        maxRiders\n        participantCount\n        status\n        coverImageUrl\n        createdAt\n        organiser {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetRideFeed($first: Int, $after: String) {\n  rideFeed(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        name\n        distanceM\n        elevationGain\n        elevationLoss\n        startedAt\n        endedAt\n        aiSummary\n        kudosCount\n        commentCount\n        hasKudos\n        routeThumbnailUri\n        rider {\n          displayName\n          avatarUrl\n          publicUsername\n        }\n        bike {\n          make\n          model\n          year\n          nickname\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n  }\n}"): (typeof documents)["query GetRideFeed($first: Int, $after: String) {\n  rideFeed(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        name\n        distanceM\n        elevationGain\n        elevationLoss\n        startedAt\n        endedAt\n        aiSummary\n        kudosCount\n        commentCount\n        hasKudos\n        routeThumbnailUri\n        rider {\n          displayName\n          avatarUrl\n          publicUsername\n        }\n        bike {\n          make\n          model\n          year\n          nickname\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query RouteDetail($routeId: ID!) {\n  routeDetail(routeId: $routeId) {\n    id\n    name\n    description\n    polyline\n    distanceM\n    elevationGainM\n    surfaceType\n    curvatureIndex\n    isMotovaultPick\n    editorialDescription\n    ratingAvg\n    ratingCount\n    commentCount\n    status\n    createdAt\n    contributor {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n  }\n}"): (typeof documents)["query RouteDetail($routeId: ID!) {\n  routeDetail(routeId: $routeId) {\n    id\n    name\n    description\n    polyline\n    distanceM\n    elevationGainM\n    surfaceType\n    curvatureIndex\n    isMotovaultPick\n    editorialDescription\n    ratingAvg\n    ratingCount\n    commentCount\n    status\n    createdAt\n    contributor {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query SavedRoutes($first: Int, $after: String) {\n  savedRoutes(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        name\n        polyline\n        distanceM\n        elevationGainM\n        surfaceType\n        isMotovaultPick\n        ratingAvg\n        ratingCount\n        commentCount\n        createdAt\n        startLat\n        startLng\n        contributor {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}"): (typeof documents)["query SavedRoutes($first: Int, $after: String) {\n  savedRoutes(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        name\n        polyline\n        distanceM\n        elevationGainM\n        surfaceType\n        isMotovaultPick\n        ratingAvg\n        ratingCount\n        commentCount\n        createdAt\n        startLat\n        startLng\n        contributor {\n          id\n          displayName\n          publicUsername\n          avatarUrl\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query SearchArticles($input: SearchArticlesInput!) {\n  searchArticles(input: $input) {\n    edges {\n      node {\n        id\n        slug\n        title\n        difficulty\n        category\n        viewCount\n        isSafetyCritical\n        generatedAt\n        updatedAt\n        keywords\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}"): (typeof documents)["query SearchArticles($input: SearchArticlesInput!) {\n  searchArticles(input: $input) {\n    edges {\n      node {\n        id\n        slug\n        title\n        difficulty\n        category\n        viewCount\n        isSafetyCritical\n        generatedAt\n        updatedAt\n        keywords\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query SpendingSummary($motorcycleId: String!) {\n  spendingSummary(motorcycleId: $motorcycleId) {\n    thisYear\n    allTime\n  }\n}"): (typeof documents)["query SpendingSummary($motorcycleId: String!) {\n  spendingSummary(motorcycleId: $motorcycleId) {\n    thisYear\n    allTime\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query TripByShareToken($shareToken: String!) {\n  tripByShareToken(shareToken: $shareToken) {\n    id\n    title\n    description\n    status\n    difficulty\n    startDate\n    endDate\n    maxRiders\n    participantCount\n    coverImageUrl\n    waypoints {\n      id\n      sortOrder\n      dayIndex\n      type\n      name\n      notes\n      lat\n      lng\n    }\n    participants {\n      anonId\n      role\n      status\n      displayName\n      avatarUrl\n    }\n  }\n}"): (typeof documents)["query TripByShareToken($shareToken: String!) {\n  tripByShareToken(shareToken: $shareToken) {\n    id\n    title\n    description\n    status\n    difficulty\n    startDate\n    endDate\n    maxRiders\n    participantCount\n    coverImageUrl\n    waypoints {\n      id\n      sortOrder\n      dayIndex\n      type\n      name\n      notes\n      lat\n      lng\n    }\n    participants {\n      anonId\n      role\n      status\n      displayName\n      avatarUrl\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query TripDetail($tripId: ID!) {\n  tripDetail(tripId: $tripId) {\n    id\n    title\n    description\n    startDate\n    endDate\n    difficulty\n    maxRiders\n    participantCount\n    status\n    visibility\n    coverImageUrl\n    createdAt\n    organiser {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n    waypoints {\n      id\n      tripId\n      sortOrder\n      dayIndex\n      type\n      name\n      notes\n      lat\n      lng\n      createdAt\n    }\n    participants {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n      role\n      status\n      bikeId\n      joinedAt\n    }\n  }\n}"): (typeof documents)["query TripDetail($tripId: ID!) {\n  tripDetail(tripId: $tripId) {\n    id\n    title\n    description\n    startDate\n    endDate\n    difficulty\n    maxRiders\n    participantCount\n    status\n    visibility\n    coverImageUrl\n    createdAt\n    organiser {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n    waypoints {\n      id\n      tripId\n      sortOrder\n      dayIndex\n      type\n      name\n      notes\n      lat\n      lng\n      createdAt\n    }\n    participants {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n      role\n      status\n      bikeId\n      joinedAt\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query TripInvites($tripId: ID!) {\n  tripInvites(tripId: $tripId) {\n    id\n    invitedUserId\n    invitedAt\n    acceptedAt\n    declinedAt\n  }\n}"): (typeof documents)["query TripInvites($tripId: ID!) {\n  tripInvites(tripId: $tripId) {\n    id\n    invitedUserId\n    invitedAt\n    acceptedAt\n    declinedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation JoinWaitlist($email: String!) {\n  joinWaitlist(email: $email)\n}"): (typeof documents)["mutation JoinWaitlist($email: String!) {\n  joinWaitlist(email: $email)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query RouteBySlug($country: String!, $region: String!, $slug: String!) {\n  routeBySlug(country: $country, region: $region, slug: $slug) {\n    id\n    name\n    description\n    distanceM\n    elevationGainM\n    surfaceType\n    curvatureIndex\n    isMotovaultPick\n    editorialDescription\n    ratingAvg\n    ratingCount\n    commentCount\n    startLat\n    startLng\n    slug\n    countryCode\n    regionSlug\n    contributor {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n  }\n}"): (typeof documents)["query RouteBySlug($country: String!, $region: String!, $slug: String!) {\n  routeBySlug(country: $country, region: $region, slug: $slug) {\n    id\n    name\n    description\n    distanceM\n    elevationGainM\n    surfaceType\n    curvatureIndex\n    isMotovaultPick\n    editorialDescription\n    ratingAvg\n    ratingCount\n    commentCount\n    startLat\n    startLng\n    slug\n    countryCode\n    regionSlug\n    contributor {\n      id\n      displayName\n      publicUsername\n      avatarUrl\n    }\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;