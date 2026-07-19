from typing import Any

from pydantic import BaseModel, Field


class WorkflowSource(BaseModel):
    mode: str
    label: str


class WorkflowScope(BaseModel):
    appStoreUrl: str
    analysisGoal: str
    storefront: str


class WorkflowStage(BaseModel):
    name: str
    status: str


class Review(BaseModel):
    id: str
    rating: int
    title: str
    body: str
    appVersion: str = ""
    source: str = ""
    appId: str = ""
    storefront: str = ""
    author: str = ""
    date: str = ""
    locale: str = ""
    rawMetadata: dict[str, Any] = Field(default_factory=dict)


class CleaningSummary(BaseModel):
    inputCount: int
    retainedCount: int
    duplicateCount: int
    discardedEmptyCount: int


class RatingSummary(BaseModel):
    averageRating: float
    ratingCounts: dict[str, int]


class AnalysisSummary(BaseModel):
    provider: str
    model: str
    modelDriven: bool


class AnalysisScope(BaseModel):
    requestedGoal: str
    focusSummary: str
    focusAreas: list[str]
    dataSignals: list[str]
    constraints: list[str]
    uncertaintyNotes: list[str]
    scopeReviewIds: list[str] = Field(default_factory=list)


class Evidence(BaseModel):
    reviewId: str
    excerpt: str


class Finding(BaseModel):
    id: str
    title: str
    reviewIds: list[str]
    sampleCount: int
    confidence: str
    method: str
    evidence: list[Evidence]
    conflictingEvidence: list[Evidence]


class Requirement(BaseModel):
    id: str
    title: str
    priority: str
    version: str
    findingIds: list[str]
    sourceReviewIds: list[str]
    boundaries: list[str]
    assumption: bool
    acceptanceCriteria: list[str] = Field(default_factory=list)


class VersionPlanItem(BaseModel):
    id: str
    name: str
    goal: str
    requirementIds: list[str]
    sourceReviewIds: list[str]


class VersionPlan(BaseModel):
    versions: list[VersionPlanItem]


class ProductRequirementDocument(BaseModel):
    title: str
    objective: str
    scopeSummary: AnalysisScope
    versions: list[VersionPlanItem]
    requirements: list[Requirement]
    successMetrics: list[str]
    assumptions: list[Requirement]


class StageReport(BaseModel):
    name: str
    status: str
    summary: str
    details: list[str] = Field(default_factory=list)
    revisions: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class TestCase(BaseModel):
    id: str
    title: str
    requirementId: str
    sourceReviewIds: list[str]
    steps: list[str]
    expectedResult: str
    verificationPoints: list[str] = Field(default_factory=list)


class TraceabilityValidation(BaseModel):
    status: str
    unsupportedFindingIds: list[str]
    unsupportedRequirementIds: list[str]
    unsupportedTestCaseIds: list[str]


class WorkflowRun(BaseModel):
    runId: str
    source: WorkflowSource
    scope: WorkflowScope
    stages: list[WorkflowStage]
    analysisScope: AnalysisScope
    rawReviews: list[Review]
    reviews: list[Review]
    cleaningSummary: CleaningSummary
    ratingSummary: RatingSummary
    analysisSummary: AnalysisSummary
    stageReports: list[StageReport]
    findings: list[Finding]
    requirements: list[Requirement]
    versionPlan: VersionPlan
    prd: ProductRequirementDocument
    testCases: list[TestCase]
    dataLimitations: list[str]
    traceabilityValidation: TraceabilityValidation
    validationMessages: list[str]


def validated_workflow_run(payload: dict[str, object]) -> dict[str, object]:
    return WorkflowRun.model_validate(payload).model_dump()
