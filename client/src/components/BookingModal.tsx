import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { CreateSession } from "@shared/types";

type BookingModalProps = {
  tutor: any; // { id (tutor_profile id), hourlyRate, subjects, user:{...}, totalReviews?, totalRating? }
  onClose: () => void;
  onConfirm: () => void;
};

// minimal client-side item used for optimistic cache
type MinimalSession = CreateSession & {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
  tutor?: any; // for student view shape
  subject?: any; // minimal subject
};

async function postSession(payload: CreateSession) {
  // Use apiRequest so Authorization header is attached
  return apiRequest("/api/sessions", { method: "POST", body: payload });
}

type Slot = { start: string; end: string; available: boolean; at: string };

export function BookingModal({ tutor, onClose, onConfirm }: BookingModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [duration, setDuration] = useState<number>(60);
  const [notes, setNotes] = useState<string>("");

  // Live availability for the chosen date & duration
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const hourlyRate = Number(tutor?.hourlyRate ?? 15);
  const sessionCost = useMemo(() => hourlyRate * (duration / 60), [hourlyRate, duration]);
  const platformFee = useMemo(() => sessionCost * 0.1, [sessionCost]);
  const totalPrice = useMemo(() => sessionCost + platformFee, [sessionCost, platformFee]);

  // Fetch availability whenever date/duration changes
  useEffect(() => {
    async function load() {
      if (!selectedDate || !tutor?.id) return;
      try {
        setLoadingSlots(true);
        setSlotsError(null);
        const yyyy_mm_dd = selectedDate.toISOString().slice(0, 10);
        const path = `/api/tutors/${encodeURIComponent(tutor.id)}/availability?date=${yyyy_mm_dd}&step=${duration}`;
        const res = await apiRequest(path);
        const serverSlots: Slot[] = Array.isArray(res?.slots) ? res.slots : [];
        setSlots(serverSlots);
        // If currently selected time became unavailable, clear it
        if (selectedTime && !serverSlots.some((s) => s.available && s.start === selectedTime)) {
          setSelectedTime("");
        }
      } catch (e: any) {
        setSlotsError(e?.message || "Failed to load availability");
      } finally {
        setLoadingSlots(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutor?.id, selectedDate?.toDateString(), duration]);

  // Show only available time labels
  const availableTimes: string[] = useMemo(
    () => slots.filter((s) => s.available).map((s) => s.start),
    [slots]
  );

  const m = useMutation({
    mutationFn: (payload: CreateSession) => postSession(payload),

    onMutate: async (payload: CreateSession) => {
      const tempId = `optimistic-${Date.now()}`;

      const firstSubject =
        Array.isArray(tutor?.subjects) && tutor.subjects.length > 0
          ? (typeof tutor.subjects[0] === "string"
              ? { id: tutor.subjects[0], name: tutor.subjects[0] }
              : { id: tutor.subjects[0]?.id, name: tutor.subjects[0]?.name })
          : undefined;

      const optimistic: MinimalSession = {
        ...payload,
        id: tempId,
        createdAt: new Date(),
        updatedAt: new Date(),
        tutor, // keep same nested shape as server response for student
        subject: firstSubject,
      };

      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["sessions"] }),
        queryClient.cancelQueries({ queryKey: ["my-sessions"] }),
      ]);

      const prevSessions = queryClient.getQueryData<MinimalSession[] | undefined>(["sessions"]);
      const prevMySessions = queryClient.getQueryData<MinimalSession[] | undefined>(["my-sessions"]);

      queryClient.setQueryData<MinimalSession[]>(["sessions"], (old) => [optimistic, ...(old ?? [])]);
      queryClient.setQueryData<MinimalSession[]>(["my-sessions"], (old) => [optimistic, ...(old ?? [])]);

      return { prevSessions, prevMySessions, tempId, optimistic, firstSubject };
    },

    onError: (err: any, _vars, ctx) => {
      if (ctx?.prevSessions) queryClient.setQueryData(["sessions"], ctx.prevSessions);
      if (ctx?.prevMySessions) queryClient.setQueryData(["my-sessions"], ctx.prevMySessions);
      toast({
        title: "Booking failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },

    onSuccess: (created: any, _vars, ctx) => {
      if (created && ctx) {
        const replaceOptimistic = (arr?: MinimalSession[]) =>
          (arr ?? []).map((s) =>
            s.id === ctx.tempId
              ? { ...created, tutor: ctx.optimistic.tutor, subject: ctx.firstSubject ?? ctx.optimistic.subject }
              : s
          );

        queryClient.setQueryData<MinimalSession[]>(["sessions"], (old) => replaceOptimistic(old));
        queryClient.setQueryData<MinimalSession[]>(["my-sessions"], (old) => replaceOptimistic(old));
      }

      toast({ title: "Success", description: "Session booked successfully!" });
      onConfirm();
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
    },
  });

  const handleBooking = () => {
    if (!user?.id) {
      toast({ title: "Sign in required", description: "Please sign in first.", variant: "destructive" });
      return;
    }
    if (!selectedDate || !selectedTime) {
      toast({ title: "Missing info", description: "Please select a date and time.", variant: "destructive" });
      return;
    }
    // Guard against stale/unavailable slot
    if (!availableTimes.includes(selectedTime)) {
      toast({
        title: "Slot unavailable",
        description: "Please pick another available time.",
        variant: "destructive",
      });
      return;
    }

    const [hh, mm] = selectedTime.split(":").map((n) => parseInt(n, 10));
    const scheduledAt = new Date(selectedDate);
    scheduledAt.setHours(hh, mm, 0, 0);

    // enforce tutor.id (tutor_profile id) because server queries sessions by tutor_profile id
    const tutorProfileId: string = String(tutor?.id || "");

    const subjectId =
      tutor?.subjects?.[0]?.id ??
      tutor?.subjects?.[0] ??
      "general";

    const payload: CreateSession = {
      studentId: user.id,
      tutorId: tutorProfileId,
      subjectId,
      scheduledAt,
      duration,
      notes,
      meetingLink: undefined,
      priceCents: Math.round(sessionCost * 100),
      status: "scheduled",
    };

    m.mutate(payload);
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-booking">
        <DialogHeader>
          <DialogTitle>Book a Session</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tutor Info */}
          <div className="flex items-center space-x-4 p-4 bg-secondary rounded-lg">
            <Avatar className="w-16 h-16">
              <AvatarImage src={tutor?.user?.profileImageUrl ?? ""} alt={tutor?.user?.firstName ?? "Tutor"} />
              <AvatarFallback>
                {(tutor?.user?.firstName?.[0] ?? "T")}{tutor?.user?.lastName?.[0] ?? ""}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold text-lg" data-testid="text-tutor-name">
                {tutor?.user?.firstName} {tutor?.user?.lastName}
              </h3>
              <p className="text-muted-foreground">
                {(tutor?.subjects ?? []).map((s: any) => (typeof s === "string" ? s : s.name)).join(", ")}
              </p>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="outline" className="bg-primary/10 text-primary">
                  ${hourlyRate}/hour
                </Badge>
                <div className="flex items-center space-x-1">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <i
                        key={i}
                        className={`fas fa-star text-sm ${
                          i < Math.floor(Number(tutor?.totalRating ?? 0)) ? "" : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ({tutor?.totalReviews ?? 0} reviews)
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
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return date < today; // server already handles weekdays; let tutors choose any day they set available
                  }}
                  className="rounded-md border"
                />
              </div>
            </div>

            {/* Time & Duration */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Available Times</Label>
                <div className="mt-2 min-h-[40px]">
                  {loadingSlots ? (
                    <div className="text-sm text-muted-foreground">Loading slots…</div>
                  ) : slotsError ? (
                    <div className="text-sm text-destructive">{slotsError}</div>
                  ) : availableTimes.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No available times for this date.</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {slots.map((s) => (
                        <Button
                          key={s.start}
                          variant={selectedTime === s.start ? "default" : "outline"}
                          size="sm"
                          onClick={() => s.available && setSelectedTime(s.start)}
                          disabled={!s.available}
                          data-testid={`button-time-${s.start}`}
                        >
                          {s.start}
                        </Button>
                      ))}
                    </div>
                  )}
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
                  onChange={(e) => setDuration(parseInt(e.target.value || "60", 10))}
                  min={30}
                  max={180}
                  step={30}
                  className="mt-2"
                  data-testid="input-duration"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Slots refresh when you change duration.
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
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
                    {format(selectedDate, "MMM dd, yyyy")} at {selectedTime}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-medium">{duration} minutes</span>
              </div>
              <div className="flex justify-between">
                <span>Hourly Rate:</span>
                <span className="font-medium">${hourlyRate}/hour</span>
              </div>
              <div className="flex justify-between">
                <span>Session Cost:</span>
                <span className="font-medium">${sessionCost.toFixed(2)}</span>
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

          {/* Actions */}
          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose} className="flex-1" data-testid="button-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleBooking}
              disabled={m.isPending || !selectedDate || !selectedTime}
              className="flex-1 btn-primary"
              data-testid="button-confirm-booking"
            >
              {m.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2" />
                  Booking...
                </>
              ) : (
                <>
                  <i className="fas fa-credit-card mr-2" />
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
