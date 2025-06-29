import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  UserPlus, 
  Users, 
  Mail, 
  CheckCircle, 
  XCircle, 
  Clock,
  RotateCcw,
  Home,
  LogOut
} from "lucide-react";

// Form validation schema
const inviteUserSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["admin", "teacher_supervisor", "teacher"], {
    required_error: "Please select a role",
  }),
});

type InviteUserForm = z.infer<typeof inviteUserSchema>;

export default function SuperAdminDashboard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  // Check authorization
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (user as any)?.role !== 'super_admin')) {
      toast({
        title: "Unauthorized Access",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    }
  }, [isAuthenticated, user, isLoading, toast]);

  // Form setup
  const form = useForm<InviteUserForm>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      role: undefined,
    },
  });

  // Fetch all users
  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ["/api/users"],
    enabled: isAuthenticated && (user as any)?.role === 'super_admin',
  });

  // Fetch user invitations
  const { data: invitations = [], isLoading: invitationsLoading, error: invitationsError } = useQuery({
    queryKey: ["/api/user-invitations"],
    enabled: isAuthenticated && (user as any)?.role === 'super_admin',
  });

  // Invite user mutation
  const inviteUserMutation = useMutation({
    mutationFn: async (data: InviteUserForm) => {
      return await apiRequest('POST', '/api/user-invitations', data);
    },
    onSuccess: () => {
      toast({
        title: "Invitation Sent",
        description: "User invitation has been sent successfully.",
      });
      form.reset();
      setIsInviteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/user-invitations"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Your session has expired. Please log in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 2000);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return await apiRequest('PATCH', `/api/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      toast({
        title: "Role Updated",
        description: "User role has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  // Toggle user active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      return await apiRequest('PATCH', `/api/users/${userId}/active`, { isActive });
    },
    onSuccess: () => {
      toast({
        title: "User Status Updated",
        description: "User status has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user status",
        variant: "destructive",
      });
    },
  });

  // Delete invitation mutation
  const deleteInvitationMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      return await apiRequest('DELETE', `/api/user-invitations/${invitationId}`);
    },
    onSuccess: () => {
      toast({
        title: "Invitation Deleted",
        description: "Invitation has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user-invitations"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete invitation",
        variant: "destructive",
      });
    },
  });

  // Resend invitation mutation
  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      return await apiRequest('POST', `/api/user-invitations/${invitationId}/resend`);
    },
    onSuccess: (data: any) => {
      // Show the invitation URL in the toast for easy access
      const inviteUrl = data.inviteUrl || data.newToken ? `${window.location.origin}/accept-invitation?token=${data.newToken}` : '';
      
      toast({
        title: "Invitation Resent",
        description: data.emailSent 
          ? "Invitation email has been sent successfully." 
          : `Email service unavailable - Using simulator mode. Check the server console for email details.${inviteUrl ? `\n\nInvitation link: ${inviteUrl}` : ''}`,
        duration: data.emailSent ? 3000 : 10000, // Show longer for simulator mode
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user-invitations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resend invitation.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InviteUserForm) => {
    inviteUserMutation.mutate(data);
  };

  // Handle authorization errors
  useEffect(() => {
    if (usersError && isUnauthorizedError(usersError)) {
      toast({
        title: "Unauthorized",
        description: "Your session has expired. Please log in again.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 2000);
    }
  }, [usersError, toast]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Super Admin</Badge>;
      case 'admin':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Admin</Badge>;
      case 'teacher_supervisor':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Teacher Supervisor</Badge>;
      case 'teacher':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Teacher</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  return (
    <>
      <div className="flex h-screen bg-gray-50">
        {/* Side Navigation */}
        <div className="w-80 bg-white shadow-lg">
          <div className="p-6">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-xl text-gray-800">ExamCraft</div>
                <div className="text-sm text-gray-500">User Management</div>
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-2">
              <Button 
                variant="outline"
                className="w-full flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-200 text-left font-medium bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-blue-200 text-blue-700"
                onClick={() => window.location.href = "/"}
              >
                <Home className="h-5 w-5 flex-shrink-0" />
                <span>Back to Dashboard</span>
              </Button>
              
              <Button 
                variant="outline"
                className="w-full flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-200 text-left font-medium bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border-green-200 text-green-700"
                onClick={() => setIsInviteDialogOpen(true)}
              >
                <UserPlus className="h-5 w-5 flex-shrink-0" />
                <span>Invite New User</span>
              </Button>
              
              <div className="mt-8 pt-6 border-t border-gray-200">
                {/* User Info */}
                <div className="mb-4 px-4 py-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                      {(user as any)?.firstName?.[0]}{(user as any)?.lastName?.[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900">
                        {(user as any)?.firstName} {(user as any)?.lastName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(user as any)?.email}
                      </div>
                    </div>
                  </div>
                </div>
                
                <Button 
                  className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                  onClick={() => window.location.href = '/api/logout'}
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  Sign Out
                </Button>
              </div>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
                <p className="text-gray-600">Manage platform users, roles, and invitations</p>
              </div>
            </div>

            <Tabs defaultValue="users" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Platform Users
                </TabsTrigger>
                <TabsTrigger value="invitations" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Pending Invitations
                </TabsTrigger>
              </TabsList>

              <TabsContent value="users">
                <Card>
                  <CardHeader>
                    <CardTitle>Platform Users</CardTitle>
                    <CardDescription>
                      Manage existing users, update roles, and control access permissions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {usersLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : (users as any[]).length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No users found.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(users as any[]).map((user: any) => (
                            <TableRow key={user.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  {user.profileImageUrl ? (
                                    <img 
                                      src={user.profileImageUrl} 
                                      alt={`${user.firstName} ${user.lastName}`}
                                      className="w-8 h-8 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                                      {user.firstName?.[0]}{user.lastName?.[0]}
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-medium">{user.firstName} {user.lastName}</div>
                                    <div className="text-sm text-gray-500">ID: {user.id}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell>{getRoleBadge(user.role)}</TableCell>
                              <TableCell>
                                {user.isActive ? (
                                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-800">Inactive</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={user.role}
                                    onValueChange={(newRole) => updateRoleMutation.mutate({ userId: user.id, role: newRole })}
                                    disabled={user.role === 'super_admin'}
                                  >
                                    <SelectTrigger className="w-[180px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="admin">Admin</SelectItem>
                                      <SelectItem value="teacher_supervisor">Teacher Supervisor</SelectItem>
                                      <SelectItem value="teacher">Teacher</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {user.role !== 'super_admin' && (
                                    <Button
                                      size="sm"
                                      variant={user.isActive ? "destructive" : "default"}
                                      onClick={() => toggleActiveMutation.mutate({ userId: user.id, isActive: !user.isActive })}
                                      disabled={toggleActiveMutation.isPending}
                                    >
                                      {user.isActive ? "Deactivate" : "Activate"}
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="invitations">
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Invitations</CardTitle>
                    <CardDescription>
                      View and manage pending user invitations to the platform.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {invitationsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : (invitations as any[]).length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No pending invitations.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(invitations as any[]).map((invitation: any) => (
                            <TableRow key={invitation.id}>
                              <TableCell className="font-medium">{invitation.email}</TableCell>
                              <TableCell>{invitation.firstName} {invitation.lastName}</TableCell>
                              <TableCell>{getRoleBadge(invitation.role)}</TableCell>
                              <TableCell>
                                {invitation.status === 'pending' && <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>}
                                {invitation.status === 'sent' && <Badge className="bg-blue-100 text-blue-800"><Mail className="w-3 h-3 mr-1" />Sent</Badge>}
                                {invitation.status === 'accepted' && <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Accepted</Badge>}
                                {invitation.status === 'expired' && <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>}
                              </TableCell>
                              <TableCell>{new Date(invitation.createdAt).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => resendInvitationMutation.mutate(invitation.id)}
                                    disabled={resendInvitationMutation.isPending || invitation.inviteStatus !== 'pending'}
                                  >
                                    {resendInvitationMutation.isPending ? "Sending..." : "Resend"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => deleteInvitationMutation.mutate(invitation.id)}
                                    disabled={deleteInvitationMutation.isPending}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogDescription>
              Send an invitation to a new user. They will receive a secure link to join the platform.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="user@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="teacher_supervisor">Teacher Supervisor</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={inviteUserMutation.isPending}>
                  {inviteUserMutation.isPending ? "Sending..." : "Send Invitation"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}