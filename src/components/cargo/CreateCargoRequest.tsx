import { useState } from 'react';
import { useKV } from '@github/spark/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CargoRequest, PricingModel, CargoCategory } from '@/types';
import { toast } from 'sonner';
import { X, Upload } from '@phosphor-icons/react';

interface CreateCargoRequestProps {
  onClose: () => void;
}

export function CreateCargoRequest({ onClose }: CreateCargoRequestProps) {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const [cargoRequests, setCargoRequests] = useKV<CargoRequest[]>('cargoRequests', []);
  const [images, setImages] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    category: 'general' as CargoCategory,
    title: '',
    description: '',
    pickupLocation: '',
    deliveryLocation: '',
    pickupDate: '',
    deliveryDate: '',
    weight: 0,
    dimensions: '',
    pricingModel: 'negotiable' as PricingModel,
    suggestedPrice: 0,
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 5 - images.length;
    if (remainingSlots <= 0) {
      toast.error('Maximum 5 images allowed');
      return;
    }

    const fileArray = Array.from(files).slice(0, remainingSlots);

    fileArray.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Only image files are allowed');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const newRequest: CargoRequest = {
      id: `cargo_${Date.now()}`,
      customerId: currentUser.id,
      category: formData.category,
      title: formData.title,
      description: formData.description,
      pickupLocation: formData.pickupLocation,
      deliveryLocation: formData.deliveryLocation,
      pickupDate: formData.pickupDate,
      deliveryDate: formData.deliveryDate,
      weight: formData.weight,
      dimensions: formData.dimensions,
      pricingModel: formData.pricingModel,
      suggestedPrice: formData.suggestedPrice > 0 ? formData.suggestedPrice : undefined,
      photos: images.length > 0 ? images : undefined,
      status: 'pending_bids',
      createdAt: new Date().toISOString(),
    };

    setCargoRequests((current) => [...(current || []), newRequest]);
    toast.success('Cargo request created successfully!');
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('cargo.createRequest')}</DialogTitle>
          <DialogDescription>
            Provide detailed information about your cargo transportation needs
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cargo-category">{t('cargo.category')}</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value as CargoCategory })}
            >
              <SelectTrigger id="cargo-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Cargo</SelectItem>
                <SelectItem value="furniture">Furniture</SelectItem>
                <SelectItem value="vehicles">Vehicles</SelectItem>
                <SelectItem value="machinery">Machinery</SelectItem>
                <SelectItem value="construction">Construction Materials</SelectItem>
                <SelectItem value="food">Food & Perishables</SelectItem>
                <SelectItem value="fragile">Fragile Items</SelectItem>
                <SelectItem value="hazardous">Hazardous Materials</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cargo-title">{t('cargo.title')}</Label>
            <Input
              id="cargo-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="e.g., Transport piano from Oslo to Trondheim"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cargo-description">{t('cargo.description')}</Label>
            <Textarea
              id="cargo-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Provide details about the cargo, special handling requirements, etc."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pickup-location">{t('cargo.pickupLocation')}</Label>
              <Input
                id="pickup-location"
                value={formData.pickupLocation}
                onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })}
                required
                placeholder="City, address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery-location">{t('cargo.deliveryLocation')}</Label>
              <Input
                id="delivery-location"
                value={formData.deliveryLocation}
                onChange={(e) => setFormData({ ...formData, deliveryLocation: e.target.value })}
                required
                placeholder="City, address"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pickup-date">{t('cargo.pickupDate')}</Label>
              <Input
                id="pickup-date"
                type="date"
                value={formData.pickupDate}
                onChange={(e) => setFormData({ ...formData, pickupDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery-date">{t('cargo.deliveryDate')}</Label>
              <Input
                id="delivery-date"
                type="date"
                value={formData.deliveryDate}
                onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cargo-weight">{t('cargo.weight')} (kg)</Label>
            <Input
              id="cargo-weight"
              type="number"
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
              required
              min="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cargo-dimensions">{t('cargo.dimensions')}</Label>
            <Input
              id="cargo-dimensions"
              value={formData.dimensions}
              onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
              placeholder="e.g., 250cm x 120cm x 180cm, or describe irregular shape"
            />
          </div>

          <div className="space-y-2">
            <Label>Cargo Photos (Max 5)</Label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  id="cargo-images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('cargo-images')?.click()}
                  disabled={images.length >= 5}
                  className="w-full"
                >
                  <Upload className="mr-2" size={18} />
                  Upload Images ({images.length}/5)
                </Button>
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {images.map((img, index) => (
                    <div key={index} className="relative group rounded-lg overflow-hidden border border-border">
                      <img
                        src={img}
                        alt={`Cargo ${index + 1}`}
                        className="w-full h-32 object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                      >
                        <X size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pricing-model">{t('cargo.pricingModel')}</Label>
              <Select
                value={formData.pricingModel}
                onValueChange={(value) => setFormData({ ...formData, pricingModel: value as PricingModel })}
              >
                <SelectTrigger id="pricing-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">{t('cargo.fixedPrice')}</SelectItem>
                  <SelectItem value="negotiable">{t('cargo.negotiable')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="suggested-price">{t('cargo.suggestedPrice')} (NOK)</Label>
              <Input
                id="suggested-price"
                type="number"
                value={formData.suggestedPrice}
                onChange={(e) => setFormData({ ...formData, suggestedPrice: Number(e.target.value) })}
                min="0"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">{t('common.submit')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
