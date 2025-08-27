import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface BookingModalProps {
  tutor: any;
  onClose: () => void;
  onConfirm: () => void;
}

export function BookingModal({ tutor, onClose, onConfirm }: BookingModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [duration, setDuration] = useState<number>(60);
  const [notes, setNotes] = useState<string>("");

  const availableTimes = [
    "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"
  ];

  const createSessionMutation = useMutation({
    mutationFn: async (sessionData: any) => {
      return await apiRequest("POST", "/api/sessions", sessionData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({
        title: "Success",
        description: "Session booked successfully!",
      });
      onConfirm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleBooking = () => {
    if (!selectedDate || !selectedTime) {
      toast({
        title: "Error",
        description: "Please select a date and time",
        variant: "destructive",
      });
      return;
    }

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduledAt = new Date(selectedDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    const sessionData = {
      tutorId: tutor.id,
      subjectId: tutor.subjects[0]?.id, // Default to first subject
      scheduledAt: scheduledAt.toISOString(),
      duration,
      notes,
      price: (parseFloat(tutor.hourlyRate) * (duration / 60)).toFixed(2),
    };

    createSessionMutation.mutate(sessionData);
  };

  const platformFee = parseFloat(tutor.hourlyRate) * (duration / 60) * 0.1;
  const totalPrice = parseFloat(tutor.hourlyRate) * (duration / 60) + platformFee;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-booking">
        <DialogHeader>
          <DialogTitle>Book a Session</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tutor Info */}
          <div className="flex items-center space-x-4 p-4 bg-secondary rounded-lg">
            <Avatar className="w-16 h-16">
              <AvatarImage src={tutor.user.profileImageUrl} alt={tutor.user.firstName} />
              <AvatarFallback>
                {tutor.user.firstName?.[0]}{tutor.user.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold text-lg" data-testid="text-tutor-name">
                {tutor.user.firstName} {tutor.user.lastName}
              </h3>
              <p className="text-muted-foreground">
                {tutor.subjects.map((s: any) => s.name).join(', ')}
              </p>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="outline" className="bg-primary/10 text-primary">
                  ${tutor.hourlyRate}/hour
                </Badge>
                <div className="flex items-center space-x-1">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <i 
                        key={i} 
                        className={`fas fa-star text-sm ${
                          i < Math.floor(parseFloat(tutor.totalRating || '0')) ? '' : 'text-gray-300'
                        }`}
                      ></i>
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ({tutor.totalReviews} reviews)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Date Selection */}
            <div>
              <Label className="text-base font-medium">Select Date</Label>
              <div className="mt-2">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date() || date.getDay() === 0} // Disable past dates and Sundays
                  className="rounded-md border"
                />
              </div>
            </div>

            {/* Time and Duration */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Available Times</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {availableTimes.map((time) => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTime(time)}
                      data-testid={`button-time-${time}`}
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="duration" className="text-base font-medium">
                  Duration (minutes)
                </Label>
                <Input
                  id="duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                  min="30"
                  max="180"
                  step="30"
                  className="mt-2"
                  data-testid="input-duration"
                />
              </div>
            </div>
          </div>

          {/* Session Notes */}
          <div>
            <Label htmlFor="notes" className="text-base font-medium">
              Session Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="What would you like to focus on in this session?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2"
              rows={3}
              data-testid="textarea-notes"
            />
          </div>

          {/* Booking Summary */}
          <div className="bg-secondary rounded-lg p-4">
            <h4 className="font-semibold mb-3">Booking Summary</h4>
            <div className="space-y-2 text-sm">
              {selectedDate && selectedTime && (
                <div className="flex justify-between">
                  <span>Date & Time:</span>
                  <span className="font-medium">
                    {format(selectedDate, 'MMM dd, yyyy')} at {selectedTime}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-medium">{duration} minutes</span>
              </div>
              <div className="flex justify-between">
                <span>Hourly Rate:</span>
                <span className="font-medium">${tutor.hourlyRate}/hour</span>
              </div>
              <div className="flex justify-between">
                <span>Session Cost:</span>
                <span className="font-medium">
                  ${(parseFloat(tutor.hourlyRate) * (duration / 60)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Platform Fee (10%):</span>
                <span className="font-medium">${platformFee.toFixed(2)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-semibold">
                <span>Total:</span>
                <span data-testid="text-total-price">${totalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBooking}
              disabled={createSessionMutation.isPending || !selectedDate || !selectedTime}
              className="flex-1 btn-primary"
              data-testid="button-confirm-booking"
            >
              {createSessionMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Booking...
                </>
              ) : (
                <>
                  <i className="fas fa-credit-card mr-2"></i>
                  Confirm & Pay
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
