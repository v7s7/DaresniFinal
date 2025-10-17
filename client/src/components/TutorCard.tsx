import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TutorCardProps {
  tutor: any;
  onBook: () => void;
  onViewProfile: () => void;
  onFavorite: () => void;
  isFavorite?: boolean;
}

export function TutorCard({ tutor, onBook, onViewProfile, onFavorite, isFavorite = false }: TutorCardProps) {
  const averageRating = parseFloat(tutor.totalRating || '0');
  const totalReviews = tutor.totalReviews || 0;

  return (
    <Card className="card-hover h-full" data-testid={`tutor-card-${tutor.id}`}>
      <CardContent className="p-6 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start space-x-4 mb-4">
          <Avatar className="w-16 h-16">
            <AvatarImage 
              src={tutor.user.profileImageUrl} 
              alt={tutor.user.firstName}
            />
            <AvatarFallback>
              {tutor.user.firstName?.[0]}{tutor.user.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-foreground truncate" data-testid="text-tutor-name">
              {tutor.user.firstName} {tutor.user.lastName}
            </h3>
            <p className="text-muted-foreground text-sm truncate">
              {tutor.subjects.map((s: any) => s.name).join(', ')}
            </p>
            
            {/* Rating */}
            <div className="flex items-center mt-2">
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <i 
                    key={i} 
                    className={`fas fa-star text-sm ${
                      i < Math.floor(averageRating) ? '' : 'text-gray-300'
                    }`}
                  ></i>
                ))}
              </div>
              <span className="text-sm text-muted-foreground ml-2" data-testid="text-rating">
                {averageRating.toFixed(1)} ({totalReviews} reviews)
              </span>
            </div>
          </div>
          
          {/* Price and Status */}
          <div className="text-right">
            <div className="text-lg font-bold text-primary" data-testid="text-hourly-rate">
              ${tutor.hourlyRate}/hr
            </div>
            <div className="flex items-center justify-end mt-1">
              <div className={`w-3 h-3 rounded-full ${
                tutor.isActive ? 'bg-green-500' : 'bg-yellow-400'
              }`}></div>
              <span className="text-xs text-muted-foreground ml-1">
                {tutor.isActive ? 'Available' : 'Busy'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Bio */}
        <p className="text-muted-foreground text-sm mb-4 line-clamp-3 flex-1">
          {tutor.bio}
        </p>
        
        {/* Subjects/Expertise Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {tutor.subjects.slice(0, 3).map((subject: any) => (
            <Badge 
              key={subject.id} 
              variant="secondary" 
              className="bg-primary/10 text-primary text-xs"
            >
              {subject.name}
            </Badge>
          ))}
          {tutor.subjects.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{tutor.subjects.length - 3} more
            </Badge>
          )}
        </div>

        {/* Verification Badge */}
        {tutor.isVerified && (
          <div className="flex items-center justify-center mb-4">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <i className="fas fa-check-circle mr-1"></i>
              Verified Tutor
            </Badge>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex space-x-2 mt-auto">
          <Button 
            className="btn-primary flex-1" 
            onClick={onBook}
            disabled={!tutor.isVerified || !tutor.isActive}
            data-testid="button-book-session"
          >
            <i className="fas fa-calendar-plus mr-2"></i>
            Book Session
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={onViewProfile}
            data-testid="button-view-profile"
          >
            <i className="fas fa-user"></i>
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={onFavorite}
            data-testid="button-favorite"
            className={isFavorite ? "text-red-500 border-red-500 hover:text-red-600 hover:border-red-600" : ""}
          >
            <i className={isFavorite ? "fas fa-heart" : "far fa-heart"}></i>
          </Button>
        </div>

        {/* Experience Highlight */}
        {tutor.experience && (
          <div className="mt-3 p-2 bg-accent/30 rounded-lg">
            <div className="flex items-center space-x-2">
              <i className="fas fa-medal text-primary text-sm"></i>
              <span className="text-sm text-muted-foreground truncate">
                {tutor.experience.substring(0, 60)}...
              </span>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center space-x-1">
            <i className="fas fa-users"></i>
            <span>150+ students</span>
          </div>
          <div className="flex items-center space-x-1">
            <i className="fas fa-clock"></i>
            <span>Response &lt; 1hr</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
