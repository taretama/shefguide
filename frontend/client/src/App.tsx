import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Chat from "@/pages/Chat";
import Checklist from "@/pages/Checklist";
import Community from "@/pages/Community";
import History from "@/pages/History";
import NotFound from "@/pages/NotFound";
import Policy from "@/pages/Policy";
import { SignIn, SignUp } from "@/pages/Auth";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/sign-in"} component={SignIn} />
      <Route path={"/sign-up"} component={SignUp} />
      <Route path={"/chat"} component={Chat} />
      <Route path={"/checklist"} component={Checklist} />
      <Route path={"/community"} component={Community} />
      <Route path={"/history"} component={History} />
      <Route path={"/privacy"}>{() => <Policy type="privacy" />}</Route>
      <Route path={"/terms"}>{() => <Policy type="terms" />}</Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      {/* Light only. ThemeProvider takes a `switchable` prop and index.css
          still carries the starter `.dark` token block, but no page uses a
          `dark:` variant and the palette is written as literal hex, so the
          toggle would recolour the shadcn primitives and nothing else. */}
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
