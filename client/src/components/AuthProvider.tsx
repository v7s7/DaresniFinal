import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signOut as firebaseSignOut,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useQueryClient } from "@tanstack/react-query";

// Types
interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: 'student' | 'tutor' | 'admin';
}

interface MeResponse {
  user: User;
  hasTutorProfile: boolean;
  tutorProfile?: any;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  signOut: () => Promise<void>;
  getAuthToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  // Get Firebase auth token
  const getAuthToken = async (): Promise<string | null> => {
    if (!firebaseUser) return null;
    try {
      return await firebaseUser.getIdToken();
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  // Fetch user data from our API
  const fetchUserData = async (firebaseUser: FirebaseUser): Promise<void> => {
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch('/api/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data: MeResponse = await response.json();
        setUser(data.user);
      } else {
        console.error('Failed to fetch user data:', response.statusText);
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUser(null);
    }
  };

  // Monitor Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        await fetchUserData(firebaseUser);
      } else {
        setUser(null);
        // Clear all cached data when user signs out
        queryClient.clear();
      }
      
      setIsLoading(false);
    });

    return unsubscribe;
  }, [queryClient]);

  // Configure API request interceptor for auth token
  useEffect(() => {
    const originalFetch = window.fetch;
    
    window.fetch = async (url, options = {}) => {
      // Only add auth header for API calls
      if (typeof url === 'string' && url.startsWith('/api/') && firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
          };
        } catch (error) {
          console.error('Error getting auth token for API call:', error);
        }
      }
      
      return originalFetch(url, options);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [firebaseUser]);

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      // User data will be fetched automatically by the auth state listener
    } catch (error) {
      console.error("Error signing in with Google:", error);
      setIsLoading(false);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const result = await signInWithEmailAndPassword(auth, email, password);
      // User data will be fetched automatically by the auth state listener
    } catch (error) {
      console.error("Error signing in with email:", error);
      setIsLoading(false);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      setIsLoading(true);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = result.user;
      
      // Update Firebase user profile
      await updateProfile(firebaseUser, {
        displayName: `${firstName} ${lastName}`.trim(),
      });
      
      // User data will be fetched automatically by the auth state listener
    } catch (error) {
      console.error("Error signing up with email:", error);
      setIsLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setFirebaseUser(null);
      queryClient.clear();
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  const value: AuthContextType = {
    firebaseUser,
    user,
    isLoading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    getAuthToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}