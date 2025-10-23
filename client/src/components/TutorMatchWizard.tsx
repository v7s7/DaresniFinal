import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Subject } from "@shared/types";

interface TutorMatchWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: (filters: TutorFilters) => void;
}

export interface TutorFilters {
  subjectId?: string;
  subjectName?: string;
  maxRate?: number;
  minRating?: number;
}

export function TutorMatchWizard({ open, onClose, onComplete }: TutorMatchWizardProps) {
  const [step, setStep] = useState(1);
  const [filters, setFilters] = useState<TutorFilters>({});

  const { data: subjects } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
    enabled: open,
  });

  const handleSubjectSelect = (subjectId: string, subjectName: string) => {
    setFilters({ ...filters, subjectId, subjectName });
    setStep(2);
  };

  const handleBudgetSelect = (maxRate: number) => {
    setFilters({ ...filters, maxRate });
    setStep(3);
  };

  const handleExperienceSelect = (minRating: number) => {
    const finalFilters = { ...filters, minRating };
    setFilters(finalFilters);
    onComplete(finalFilters);
    handleReset();
  };

  const handleReset = () => {
    setStep(1);
    setFilters({});
    onClose();
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleReset}>
      <DialogContent className="sm:max-w-[600px]" data-testid="dialog-tutor-match-wizard">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Find Your Perfect Tutor
          </DialogTitle>
          <div className="flex items-center justify-center space-x-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 w-16 rounded-full transition-colors ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
                data-testid={`progress-step-${s}`}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="mt-6">
          {/* Step 1: Subject Selection */}
          {step === 1 && (
            <div className="space-y-4" data-testid="step-subject">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">What subject do you need help with?</h3>
                <p className="text-sm text-muted-foreground">Choose the subject you want to learn</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-6">
                {Array.isArray(subjects) && subjects.length > 0 ? (
                  subjects.map((subject) => (
                    <Button
                      key={subject.id}
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center justify-center space-y-2 hover:border-primary hover:bg-primary/5"
                      onClick={() => handleSubjectSelect(subject.id, subject.name)}
                      data-testid={`button-subject-${subject.id}`}
                    >
                      <i className="fas fa-book text-2xl text-primary"></i>
                      <span className="font-medium">{subject.name}</span>
                      {subject.category && (
                        <Badge variant="secondary" className="text-xs">
                          {subject.category}
                        </Badge>
                      )}
                    </Button>
                  ))
                ) : (
                  <div className="col-span-2 text-center py-8 text-muted-foreground">
                    <i className="fas fa-spinner fa-spin text-2xl mb-2"></i>
                    <p>Loading subjects...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Budget Selection */}
          {step === 2 && (
            <div className="space-y-4" data-testid="step-budget">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">What's your budget?</h3>
                <p className="text-sm text-muted-foreground">Select your maximum hourly rate</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <Button
                  variant="outline"
                  className="h-auto py-6 flex flex-col items-center space-y-2 hover:border-primary hover:bg-primary/5"
                  onClick={() => handleBudgetSelect(2500)}
                  data-testid="button-budget-25"
                >
                  <i className="fas fa-coins text-2xl text-green-500"></i>
                  <span className="text-xl font-bold">Under $25/hr</span>
                  <span className="text-sm text-muted-foreground">Budget-friendly</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-6 flex flex-col items-center space-y-2 hover:border-primary hover:bg-primary/5"
                  onClick={() => handleBudgetSelect(5000)}
                  data-testid="button-budget-50"
                >
                  <i className="fas fa-dollar-sign text-2xl text-blue-500"></i>
                  <span className="text-xl font-bold">Under $50/hr</span>
                  <span className="text-sm text-muted-foreground">Moderate</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-6 flex flex-col items-center space-y-2 hover:border-primary hover:bg-primary/5"
                  onClick={() => handleBudgetSelect(10000)}
                  data-testid="button-budget-100"
                >
                  <i className="fas fa-gem text-2xl text-purple-500"></i>
                  <span className="text-xl font-bold">Under $100/hr</span>
                  <span className="text-sm text-muted-foreground">Premium</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-6 flex flex-col items-center space-y-2 hover:border-primary hover:bg-primary/5"
                  onClick={() => handleBudgetSelect(999999)}
                  data-testid="button-budget-any"
                >
                  <i className="fas fa-infinity text-2xl text-primary"></i>
                  <span className="text-xl font-bold">Any Budget</span>
                  <span className="text-sm text-muted-foreground">Show all</span>
                </Button>
              </div>

              <div className="flex justify-center mt-4">
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  data-testid="button-back"
                >
                  <i className="fas fa-arrow-left mr-2"></i>
                  Back
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Experience Level */}
          {step === 3 && (
            <div className="space-y-4" data-testid="step-experience">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">What level of experience do you prefer?</h3>
                <p className="text-sm text-muted-foreground">Choose based on tutor ratings and reviews</p>
              </div>

              <div className="grid grid-cols-1 gap-3 mt-6">
                <Button
                  variant="outline"
                  className="h-auto py-6 flex items-center space-x-4 hover:border-primary hover:bg-primary/5"
                  onClick={() => handleExperienceSelect(0)}
                  data-testid="button-experience-any"
                >
                  <div className="flex-shrink-0">
                    <i className="fas fa-users text-3xl text-primary"></i>
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-lg">Any Experience Level</div>
                    <div className="text-sm text-muted-foreground">Show me all available tutors</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-6 flex items-center space-x-4 hover:border-primary hover:bg-primary/5"
                  onClick={() => handleExperienceSelect(3.5)}
                  data-testid="button-experience-good"
                >
                  <div className="flex-shrink-0">
                    <i className="fas fa-star text-3xl text-yellow-500"></i>
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-lg">Good Tutors (3.5+ stars)</div>
                    <div className="text-sm text-muted-foreground">Well-rated tutors with positive reviews</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-6 flex items-center space-x-4 hover:border-primary hover:bg-primary/5"
                  onClick={() => handleExperienceSelect(4.5)}
                  data-testid="button-experience-excellent"
                >
                  <div className="flex-shrink-0">
                    <i className="fas fa-trophy text-3xl text-amber-500"></i>
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-lg">Excellent Tutors (4.5+ stars)</div>
                    <div className="text-sm text-muted-foreground">Top-rated tutors with excellent track records</div>
                  </div>
                </Button>
              </div>

              <div className="flex justify-center mt-4">
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  data-testid="button-back"
                >
                  <i className="fas fa-arrow-left mr-2"></i>
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Selected Filters Summary */}
        {step > 1 && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="text-sm font-medium mb-2">Your Selections:</div>
            <div className="flex flex-wrap gap-2">
              {filters.subjectName && (
                <Badge variant="default">
                  <i className="fas fa-book mr-1"></i>
                  {filters.subjectName}
                </Badge>
              )}
              {filters.maxRate && filters.maxRate < 999999 && (
                <Badge variant="default">
                  <i className="fas fa-dollar-sign mr-1"></i>
                  Under ${filters.maxRate / 100}/hr
                </Badge>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
