import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, User } from '@phosphor-icons/react';

type AuthTab = 'customer' | 'carrier';

type AuthFormData = {
  name: string;
  email: string;
  phone: string;
  city: string;
  companyName: string;
  organizationNumber: string;
  description: string;
  specializations: string;
};

export function AuthScreen() {
  const { signUp } = useAuth();
  const { t } = useLanguage();
  const [tab, setTab] = useState<AuthTab>('customer');

  const [formData, setFormData] = useState<AuthFormData>({
    name: '',
    email: '',
    phone: '',
    city: '',
    companyName: '',
    organizationNumber: '',
    description: '',
    specializations: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (tab === 'customer') {
      signUp({
        role: 'customer',
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        city: formData.city,
      });
    } else {
      signUp({
        role: 'carrier',
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        city: formData.city,
        companyName: formData.companyName,
        organizationNumber: formData.organizationNumber,
        description: formData.description,
        specializations: formData.specializations.split(',').map((item) => item.trim()),
        verified: true,
      } as any);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Truck className="text-primary" size={48} weight="bold" />
            <h1 className="text-4xl font-bold text-primary">{t('common.appName')}</h1>
          </div>
          <CardTitle>{t('auth.signUpAsCustomer')}</CardTitle>
          <CardDescription>Modern cargo transportation marketplace</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(value) => setTab(value as AuthTab)}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="customer" className="flex items-center gap-2">
                <User size={18} />
                {t('auth.signUpAsCustomer')}
              </TabsTrigger>
              <TabsTrigger value="carrier" className="flex items-center gap-2">
                <Truck size={18} />
                {t('auth.signUpAsCarrier')}
              </TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="space-y-4">
              <TabsContent value="customer" className="space-y-4 mt-0">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('auth.name')}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('auth.phone')}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">{t('auth.city')}</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
              </TabsContent>

              <TabsContent value="carrier" className="space-y-4 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="carrier-name">{t('auth.name')}</Label>
                    <Input
                      id="carrier-name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-name">{t('auth.companyName')}</Label>
                    <Input
                      id="company-name"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-number">{t('auth.organizationNumber')}</Label>
                  <Input
                    id="org-number"
                    value={formData.organizationNumber}
                    onChange={(e) => setFormData({ ...formData, organizationNumber: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="carrier-email">{t('auth.email')}</Label>
                    <Input
                      id="carrier-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carrier-phone">{t('auth.phone')}</Label>
                    <Input
                      id="carrier-phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="carrier-city">{t('auth.city')}</Label>
                  <Input
                    id="carrier-city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">{t('auth.description')}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specializations">{t('auth.specializations')}</Label>
                  <Input
                    id="specializations"
                    value={formData.specializations}
                    onChange={(e) => setFormData({ ...formData, specializations: e.target.value })}
                    placeholder="Furniture, Heavy machinery, Perishables"
                  />
                </div>
              </TabsContent>

              <Button type="submit" className="w-full" size="lg">
                {tab === 'customer' ? t('auth.signUpAsCustomer') : t('auth.signUpAsCarrier')}
              </Button>
            </form>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
