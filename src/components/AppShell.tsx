import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings,
  Target,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const learningItems = [
  { title: "Courses", url: "/courses?tab=courses", tab: "courses", icon: BookOpen },
  { title: "Subjects", url: "/courses?tab=subjects", tab: "subjects", icon: Target },
  { title: "Syllabus", url: "/courses?tab=syllabus", tab: "syllabus", icon: ListChecks },
  { title: "Tests", url: "/courses?tab=tests", tab: "tests", icon: ClipboardList },
  { title: "Analytics", url: "/courses?tab=progress", tab: "progress", icon: BarChart3 },
];

function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const selectedTab = new URLSearchParams(location.search).get("tab") ?? "courses";

  const closeMobile = () => setOpenMobile(false);
  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Signed out", description: "Your study progress is safely saved." });
    navigate("/auth");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3">
        <NavLink to="/" onClick={closeMobile} className="flex h-10 items-center gap-3 overflow-hidden rounded-md px-1">
          <div className="hero-gradient flex size-8 shrink-0 items-center justify-center rounded-md shadow-glow">
            <GraduationCap className="size-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate font-semibold text-sidebar-foreground">Course Tracker</p>
              <p className="truncate text-xs text-sidebar-foreground/60">Study workspace</p>
            </div>
          )}
        </NavLink>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === "/" || location.pathname === "/dashboard"} tooltip="Progress Sheet">
                  <NavLink to="/" onClick={closeMobile}>
                    <LayoutDashboard />
                    <span>Progress Sheet</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Learning</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {learningItems.map((item) => (
                <SidebarMenuItem key={item.tab}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === "/courses" && selectedTab === item.tab}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url} onClick={closeMobile}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === "/reports"} tooltip="Reports">
                  <NavLink to="/reports" onClick={closeMobile}>
                    <FileText />
                    <span>Reports</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === "/settings"} tooltip="Settings">
                  <NavLink to="/settings" onClick={closeMobile}>
                    <Settings />
                    <span>Settings</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out" aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function AppShell() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border/70 bg-background/90 px-4 backdrop-blur-md md:px-6">
            <SidebarTrigger className="size-9" />
            <div className="ml-3 h-5 w-px bg-border" />
            <span className="ml-3 text-sm font-medium text-muted-foreground">Your study workspace</span>
          </header>
          <Outlet />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}