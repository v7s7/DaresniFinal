import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TutorProfile, User, Subject } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TutorCard } from "@/components/TutorCard";
import { BookingModal } from "@/components/BookingModal";

export default function TutorBrowse() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("rating");
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState<any>(null);

  const { data: tutors, isLoading: tutorsLoading } = useQuery<Array<TutorProfile & { user: User, subjects: Subject[] }>>({
    queryKey: ["/api/tutors"],
  });

  const { data: subjects } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
  });

  const filteredTutors = Array.isArray(tutors) ? tutors.filter((tutor: any) => {
    const matchesSearch = 
      tutor.user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tutor.user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tutor.subjects.some((s: any) => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesSubject = selectedSubject === "all" || 
      tutor.subjects.some((s: any) => s.id === selectedSubject);
    
    return matchesSearch && matchesSubject;
  }).sort((a: any, b: any) => {
    switch (sortBy) {
      case "rating":
        return parseFloat(b.totalRating || '0') - parseFloat(a.totalRating || '0');
      case "price-low":
        return parseFloat(a.hourlyRate || '0') - parseFloat(b.hourlyRate || '0');
      case "price-high":
        return parseFloat(b.hourlyRate || '0') - parseFloat(a.hourlyRate || '0');
      case "reviews":
        return (b.totalReviews || 0) - (a.totalReviews || 0);
      default:
        return 0;
    }
  }) : [];

  const handleBookSession = (tutor: any) => {
    setSelectedTutor(tutor);
    setShowBookingModal(true);
  };

  const handleBookingConfirm = () => {
    setShowBookingModal(false);
    // Booking logic would be handled in the modal
  };

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4" data-testid="text-browse-title">
            Find Your Perfect Tutor
          </h1>
          <p className="text-muted-foreground">
            Browse through our verified tutors and book your ideal learning session
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <Input
                  placeholder="Search tutors or subjects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              <div>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger data-testid="select-subject">
                    <SelectValue placeholder="All Subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {Array.isArray(subjects) ? subjects.map((subject: any) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    )) : null}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger data-testid="select-sort">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rating">Highest Rated</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="reviews">Most Reviews</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedSubject("all");
                    setSortBy("rating");
                  }}
                  data-testid="button-clear-filters"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {filteredTutors.length} tutors found
            </h2>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="bg-primary/10 text-primary">
                <i className="fas fa-check-circle mr-1"></i>
                All verified
              </Badge>
            </div>
          </div>
        </div>

        {/* Tutors Grid */}
        {tutorsLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-muted rounded-full"></div>
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                      </div>
                    </div>
                    <div className="h-3 bg-muted rounded"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTutors.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTutors.map((tutor: any) => (
              <TutorCard
                key={tutor.id}
                tutor={tutor}
                onBook={() => handleBookSession(tutor)}
                onViewProfile={() => window.location.href = `/tutor/${tutor.id}`}
                onFavorite={() => {
                  // Handle favorite logic
                }}
              />
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <div className="space-y-4">
                <i className="fas fa-search text-4xl text-muted-foreground"></i>
                <h3 className="text-xl font-semibold">No tutors found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search criteria or browse all tutors
                </p>
                <Button 
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedSubject("all");
                  }}
                  data-testid="button-browse-all"
                >
                  Browse All Tutors
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Load More (if needed) */}
        {filteredTutors.length > 12 && (
          <div className="text-center mt-8">
            <Button variant="outline" data-testid="button-load-more">
              Load More Tutors
            </Button>
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {showBookingModal && selectedTutor && (
        <BookingModal
          tutor={selectedTutor}
          onClose={() => setShowBookingModal(false)}
          onConfirm={handleBookingConfirm}
        />
      )}
    </div>
  );
}
