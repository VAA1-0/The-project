"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Separator } from "./ui/separator";
import { GameRunLogo } from "./ProjectLogo";

const Play: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M5 3v18l15-9L5 3z" fill="currentColor" />
  </svg>
);

const Zap: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="currentColor" />
  </svg>
);

const Brain: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <path
      d="M12 2a6 6 0 00-6 6v2H4v6h16v-6h-2V8a6 6 0 00-6-6z"
      fill="currentColor"
    />
  </svg>
);

interface LandingPageProps {
  onAuthenticate: () => void;
}

export function LandingPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);

  /*
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate authentication
    setTimeout(onAuthenticate, 1000);
  };

  */

  const handleGoogleSignIn = () => {
    // Simulate Google authentication
    router.push("/dashboard");
  };
  

  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="p-6 flex items-center justify-between">
        <GameRunLogo size="lg" />
      </header>

      <div className="container mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Hero content */}
          <div className="text-white dark:text-white text-slate-900 space-y-8">
            <h1 className="text-5xl text-white dark:text-white text-slate-900">
              AI-Powered Video Analysis
            </h1>
            <p className="text-xl text-slate-300 dark:text-slate-300 text-slate-600">
              Upload your videos and get instant AI-powered insights,
              descriptions, and analysis. Transform your content with
              intelligent video understanding.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600/20 p-3 rounded-lg">
                  <Play className="w-6 h-6 text-blue-400 dark:text-blue-400 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-white dark:text-white text-slate-900">
                    Smart Analysis
                  </h3>
                  <p className="text-slate-400 dark:text-slate-400 text-slate-600">
                    Advanced AI insights
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-purple-600/20 p-3 rounded-lg">
                  <Zap className="w-6 h-6 text-purple-400 dark:text-purple-400 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-white dark:text-white text-slate-900">
                    Fast Processing
                  </h3>
                  <p className="text-slate-400 dark:text-slate-400 text-slate-600">
                    Instant results
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-green-600/20 p-3 rounded-lg">
                  <Brain className="w-6 h-6 text-green-400 dark:text-green-400 text-green-600" />
                </div>
                <div>
                  <h3 className="text-white dark:text-white text-slate-900">
                    Deep Insights
                  </h3>
                  <p className="text-slate-400 dark:text-slate-400 text-slate-600 text-nowrap">
                    Comprehensive analysis
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Auth form */}
          <div className="flex justify-center">
            <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 dark:bg-slate-800/50 dark:border-slate-700 bg-white border-slate-200">
              <CardHeader className="text-center">
                <CardTitle className="text-white dark:text-white text-slate-900">
                  {isSignUp ? "Create Account" : "Welcome Back"}
                </CardTitle>
                <CardDescription className="text-slate-300 dark:text-slate-300 text-slate-600">
                  {isSignUp
                    ? "Sign up to start analyzing your videos"
                    : "Sign in to your GameRun account"}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <Button
                  onClick={handleGoogleSignIn}
                  variant="outline"
                  className="w-full border-slate-600 text-white hover:bg-slate-700 hover:text-white dark:border-slate-600 dark:text-white dark:hover:bg-slate-700 dark:hover:text-white border-slate-300 text-slate-900 hover:bg-slate-100"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </Button>

                <div className="relative">
                  <Separator className="bg-slate-600 dark:bg-slate-600 bg-slate-300" />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-800 px-2 text-slate-400 dark:bg-slate-800 dark:text-slate-400 bg-white text-slate-500">
                    or
                  </span>
                </div>

                <form /*onSubmit={handleSubmit}*/ className="space-y-4">
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder:text-slate-400 bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-500"
                    required
                  />

                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder:text-slate-400 bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-500"
                    required
                  />

                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {isSignUp ? "Create Account" : "Sign In"}
                  </Button>
                </form>

                <div className="text-center">
                  <button
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-blue-400 hover:text-blue-300 underline dark:text-blue-400 dark:hover:text-blue-300 text-blue-600 hover:text-blue-700"
                  >
                    {isSignUp
                      ? "Already have an account? Sign in"
                      : "Need an account? Sign up"}
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
