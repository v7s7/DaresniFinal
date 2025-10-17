import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TutorProfile, User, Subject, Review } from "@shared/schema";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { BookingModal } from "@/components/BookingModal";
import { ChatWindow } from "@/components/ChatWindow";
import { useAuth } from "@/hooks/useAuth";

export default function TutorProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const { data: tutors } = useQuery<Array<TutorProfile & { user: User, subjects: Subject[] }>>({
    queryKey: ["/api/tutors"],
  });

  const { data: reviews } = useQuery<Array<Review & { student: User }>>({
    queryKey: ["/api/reviews", id],
    enabled: !!id,
  });

  const tutor = tutors?.find((t: any) => t.id === id);

  const handleBookSession = () => {
    if (!user) {
      window.location.href = "/api/login";
      return;
    }
    setShowBookingModal(true);
  };

  const handleStartChat = () => {
    if (!user) {
      window.location.href = "/api/login";
      return;
    }
    setShowChat(true);
  };

  const handleBookingConfirm = () => {
    setShowBookingModal(false);
  };

  if (!tutor) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <div className="container mx-auto px-4 py-8">
          <Card className="text-center py-12">
            <CardContent>
              <div className="space-y-4">
                <i className="fas fa-user-slash text-4xl text-muted-foreground"></i>
                <h3 className="text-xl font-semibold">Tutor not found</h3>
                <p className="text-muted-foreground">
                  The tutor you're looking for doesn't exist or may have been removed.
                </p>
                <Button onClick={() => window.location.href = "/tutors"}>
                  Browse Tutors
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const averageRating = parseFloat(tutor.totalRating || '0');
  const totalReviews = tutor.totalReviews || 0;

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Profile */}
          <div className="lg:col-span-2 space-y-8">
            {/* Profile Header */}
            <Card>
              <CardContent className="p-8">
                <div className="flex items-start space-x-6">
                  <Avatar className="w-24 h-24">
                    <AvatarImage 
                      src={tutor.user.profileImageUrl || undefined} 
                      alt={tutor.user.firstName || 'Tutor'}
                    />
                    <AvatarFallback className="text-2xl">
                      {tutor.user.firstName?.[0]}{tutor.user.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h1 className="text-3xl font-bold text-foreground" data-testid="text-tutor-name">
                          {tutor.user.firstName} {tutor.user.lastName}
                        </h1>
                        <p className="text-muted-foreground text-lg">
                          {tutor.subjects.map((s: any) => s.name).join(' • ')}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-primary" data-testid="text-hourly-rate">
                          ${tutor.hourlyRate}/hr
                        </div>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <i className="fas fa-check-circle mr-1"></i>
                          Verified
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6 mb-6">
                      <div className="flex items-center space-x-2">
                        <div className="flex text-yellow-400">
                          {[...Array(5)].map((_, i) => (
                            <i 
                              key={i} 
                              className={`fas fa-star ${i < Math.floor(averageRating) ? '' : 'text-gray-300'}`}
                            ></i>
                          ))}
                        </div>
                        <span className="font-medium" data-testid="text-rating">
                          {averageRating.toFixed(1)}
                        </span>
                        <span className="text-muted-foreground">
                          ({totalReviews} reviews)
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-muted-foreground">Available today</span>
                      </div>
                    </div>

                    <div className="flex space-x-4">
                      <Button 
                        size="lg" 
                        className="btn-primary px-8"
                        onClick={handleBookSession}
                        data-testid="button-book-session"
                      >
                        <i className="fas fa-calendar-plus mr-2"></i>
                        Book Session
                      </Button>
                      <Button 
                        variant="outline" 
                        size="lg"
                        onClick={handleStartChat}
                        data-testid="button-message"
                      >
                        <i className="fas fa-comment mr-2"></i>
                        Message
                      </Button>
                      <Button 
                        variant="outline" 
                        size="lg"
                        data-testid="button-favorite"
                      >
                        <i className="far fa-heart"></i>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="about" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="about">About</TabsTrigger>
                <TabsTrigger value="experience">Experience</TabsTrigger>
                <TabsTrigger value="reviews">Reviews ({totalReviews})</TabsTrigger>
                <TabsTrigger value="availability">Availability</TabsTrigger>
              </TabsList>

              <TabsContent value="about">
                <Card>
                  <CardHeader>
                    <CardTitle>About {tutor.user.firstName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold mb-2">Bio</h4>
                        <p className="text-muted-foreground leading-relaxed">
                          {tutor.bio}
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold mb-3">Subjects</h4>
                        <div className="flex flex-wrap gap-2">
                          {tutor.subjects.map((subject: any) => (
                            <Badge key={subject.id} variant="outline" className="bg-primary/10 text-primary">
                              {subject.name}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Teaching Style</h4>
                        <p className="text-muted-foreground">
                          Personalized approach focusing on individual learning needs and goals.
                          Interactive sessions with real-world examples and practical applications.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="experience">
                <Card>
                  <CardHeader>
                    <CardTitle>Experience & Qualifications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold mb-2">Teaching Experience</h4>
                        <p className="text-muted-foreground leading-relaxed">
                          {tutor.experience}
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold mb-2">Education</h4>
                        <p className="text-muted-foreground leading-relaxed">
                          {tutor.education}
                        </p>
                      </div>

                      {tutor.certifications && tutor.certifications.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-3">Certifications</h4>
                          <div className="space-y-2">
                            {tutor.certifications.map((cert: string, index: number) => (
                              <div key={index} className="flex items-center space-x-2">
                                <i className="fas fa-certificate text-primary"></i>
                                <span>{cert}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reviews">
                <Card>
                  <CardHeader>
                    <CardTitle>Student Reviews</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {reviews && reviews.length > 0 ? (
                      <div className="space-y-6">
                        {reviews.map((review: any) => (
                          <div key={review.id} className="border-b border-border pb-6 last:border-b-0">
                            <div className="flex items-start space-x-4">
                              <Avatar>
                                <AvatarImage 
                                  src={review.student.profileImageUrl} 
                                  alt={review.student.firstName}
                                />
                                <AvatarFallback>
                                  {review.student.firstName?.[0]}{review.student.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className="font-medium">
                                    {review.student.firstName} {review.student.lastName}
                                  </span>
                                  <div className="flex text-yellow-400">
                                    {[...Array(review.rating)].map((_, i) => (
                                      <i key={i} className="fas fa-star text-sm"></i>
                                    ))}
                                  </div>
                                  <span className="text-sm text-muted-foreground">
                                    {new Date(review.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-muted-foreground">{review.comment}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <i className="fas fa-star-half-alt text-4xl mb-4"></i>
                        <p>No reviews yet</p>
                        <p className="text-sm mt-2">Be the first to review this tutor</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="availability">
                <Card>
                  <CardHeader>
                    <CardTitle>Schedule a Session</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-4">Select Date</h4>
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          className="rounded-md border"
                          disabled={(date) => date < new Date()}
                        />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-4">Available Times</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'].map((time) => (
                            <Button
                              key={time}
                              variant="outline"
                              className="justify-center"
                              data-testid={`button-time-${time.replace(/[^a-zA-Z0-9]/g, '-')}`}
                            >
                              {time}
                            </Button>
                          ))}
                        </div>
                        <Button 
                          className="w-full mt-6 btn-primary"
                          onClick={handleBookSession}
                          data-testid="button-book-selected-time"
                        >
                          Book Selected Time
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Response time:</span>
                    <span className="font-medium">&lt; 1 hour</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total students:</span>
                    <span className="font-medium">150+</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sessions completed:</span>
                    <span className="font-medium">500+</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Member since:</span>
                    <span className="font-medium">Jan 2023</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact {tutor.user.firstName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button 
                    className="w-full btn-primary"
                    onClick={handleBookSession}
                    data-testid="button-book-now"
                  >
                    <i className="fas fa-calendar-plus mr-2"></i>
                    Book Now
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleStartChat}
                    data-testid="button-send-message"
                  >
                    <i className="fas fa-comment mr-2"></i>
                    Send Message
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Similar Tutors */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Similar Tutors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.isArray(tutors) ? tutors.filter((t: any) => t.id !== tutor.id).slice(0, 3).map((similarTutor: any) => (
                    <div key={similarTutor.id} className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarImage 
                          src={similarTutor.user.profileImageUrl} 
                          alt={similarTutor.user.firstName}
                        />
                        <AvatarFallback>
                          {similarTutor.user.firstName?.[0]}{similarTutor.user.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {similarTutor.user.firstName} {similarTutor.user.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ${similarTutor.hourlyRate}/hr
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.location.href = `/tutor/${similarTutor.id}`}
                      >
                        View
                      </Button>
                    </div>
                  )) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <BookingModal
          tutor={tutor}
          onClose={() => setShowBookingModal(false)}
          onConfirm={handleBookingConfirm}
        />
      )}

      {/* Chat Window */}
      {showChat && (
        <ChatWindow
          userId={tutor.userId}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
}
