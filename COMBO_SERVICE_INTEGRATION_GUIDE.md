/**
 * COMBOSERVICE API INTEGRATION GUIDE FOR GLAMSCANSTYLER
 * 
 * THIS DOCUMENT PROVIDES INSTRUCTIONS ON HOW TO INTEGRATE COMBO SERVICES API
 * INTO BOTH SelectServiceScreen AND MyServiceScreen
 */

/**
 * ==========================================
 * 1. COMBOSERVICE API ENDPOINTS
 * ==========================================
 */

const API_BASE = 'http://YOUR_BACKEND_IP:3000/api';

/**
 * PUBLIC ENDPOINTS - No auth required
 */
const COMBO_SERVICE_ENDPOINTS = {
  // Get all active combo services
  GET_ALL: `${API_BASE}/combo-services`,
  
  // Get specific combo service by ID
  GET_BY_ID: (id: string) => `${API_BASE}/combo-services/${id}`,
  
  // Get all unique categories
  GET_CATEGORIES: `${API_BASE}/combo-services/categories/list`,
};

/**
 * Query Parameters Supported:
 * - ?genderSupport=Female
 * - ?serviceType=Hair,Makeup
 * - ?category=Bridal
 * - ?isActive=true
 * 
 * Example: /combo-services?genderSupport=Female&category=Premium
 */

/**
 * ==========================================
 * 2. RESPONSE FORMAT
 * ==========================================
 */

interface IComboServiceResponse {
  _id: string;
  comboName: string;
  description: string;
  image: string;
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  duration: string; // e.g., "180 mins"
  genderSupport: string[]; // ["Female", "Both"]
  serviceType: string[]; // ["Hair", "Color"]
  includedServices: {
    serviceId: string;
    serviceName: string;
    duration: string;
  }[];
  category: string; // "Bridal", "Premium", "Regular"
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}


/**
 * ==========================================
 * 3. INTEGRATION INTO SelectServiceScreen
 * ==========================================
 */

/*
STEPS:
1. Add a new state for combo services
2. Add a new tab/section to display combo services
3. Fetch combo services when component mounts
4. Allow selection of combo services same way as regular services
5. Store combo selections with serviceId or comboId
*/

// ADD TO STATE:
// const [comboServices, setComboServices] = useState<IComboServiceResponse[]>([]);
// const [selectedComboServices, setSelectedComboServices] = useState<Set<string>>(new Set());

// ADD TO useEffect:
/*
useEffect(() => {
  let isMounted = true;
  const loadComboServices = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL_WITH_API}/combo-services?isActive=true`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch combo services');

      const result = await response.json();
      if (result.success && isMounted) {
        setComboServices(result.data);
        console.log('✅ Combo services fetched:', result.data);
      }
    } catch (error) {
      console.error('❌ Error fetching combo services:', error);
    } finally {
      setLoading(false);
    }
  };

  loadComboServices();

  return () => {
    isMounted = false;
  };
}, []);
*/

// ADD TO RENDER (after regular services list):
/*
{/* Combo Services Section *\/}
<View style={styles.sectionDivider}>
  <Text style={styles.sectionTitle}>Premium Combo Packages</Text>
</View>

{comboServices.map((combo) => {
  const isSelected = selectedComboServices.has(combo._id);
  
  return (
    <View key={combo._id} style={styles.serviceCard}>
      <View style={styles.serviceContent}>
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceTitle}>{combo.comboName}</Text>
          <Text style={styles.serviceDescription}>{combo.description}</Text>
          
          {/* Price */}
          <View style={styles.priceContainer}>
            <Text style={styles.originalPrice}>₹{combo.originalPrice}</Text>
            <Text style={styles.discountedPrice}>₹{combo.discountedPrice}</Text>
            <Text style={styles.discountBadge}>-{combo.discountPercentage}%</Text>
          </View>
          
          {/* Duration */}
          <Text style={styles.duration}>⏱ {combo.duration}</Text>
          
          {/* Tags */}
          <View style={styles.tagsContainer}>
            {combo.genderSupport.map((gender) => (
              <View key={gender} style={styles.tag}>
                <Text style={styles.tagText}>{gender}</Text>
              </View>
            ))}
            {combo.serviceType.map((type) => (
              <View key={type} style={styles.tag}>
                <Text style={styles.tagText}>{type}</Text>
              </View>
            ))}
          </View>
        </View>
        
        <Switch
          value={isSelected}
          onValueChange={(value) => {
            if (value) {
              setPendingServiceId(combo._id);
              setShowModal(true);
              setAmount(combo.discountedPrice.toString());
            } else {
              const newSelected = new Set(selectedComboServices);
              newSelected.delete(combo._id);
              setSelectedComboServices(newSelected);
            }
          }}
          trackColor={{ false: '#E0E0E0', true: '#FD8B36' }}
          thumbColor="#fff"
        />
      </View>
    </View>
  );
})}
*/


/**
 * ==========================================
 * 4. INTEGRATION INTO MyServiceScreen
 * ==========================================
 */

/*
STEPS:
1. Fetch all available combo services to show as "Add More" options
2. Display stylist's selected combo services same way as regular services
3. Allow editing price/details for combo services
4. Save combo service selections to backend
*/

// ADD TO STATE:
// const [availableComboServices, setAvailableComboServices] = useState<IComboServiceResponse[]>([]);

// ADD TO useEffect for fetching:
/*
useEffect(() => {
  const fetchComboServices = async () => {
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/combo-services?isActive=true`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch combo services');

      const result = await response.json();
      if (result.success) {
        setAvailableComboServices(result.data);
        console.log('✅ Combo services fetched for MyServiceScreen');
      }
    } catch (error) {
      console.error('❌ Error fetching combo services:', error);
    }
  };

  fetchComboServices();
}, []);
*/

// DISPLAY COMBO SERVICES:
/*
{/* Display Selected Combo Services *\/}
<Text style={styles.sectionTitle}>Combo Services</Text>

{services
  .filter((s) => s.isCombo === true) // Filter for combo services
  .map((service, index) => (
    <View key={index} style={styles.serviceItem}>
      <Text style={styles.serviceName}>{service.serviceName}</Text>
      <Text style={styles.servicePrice}>₹{service.amount}</Text>
      
      <TouchableOpacity
        onPress={() => {
          setEditingService(service);
          setEditingServiceIndex(index);
          setAmount(service.amount.toString());
          setShowEditModal(true);
        }}
        style={styles.editButton}
      >
        <Text style={styles.editButtonText}>Edit</Text>
      </TouchableOpacity>
    </View>
  ))}

{/* Add More Combo Services *\/}
<TouchableOpacity
  onPress={() => {
    setShowAddServiceModal(true);
    // Show available combo services to add
  }}
  style={styles.addButton}
>
  <Icon name="add" size={24} color="#FD8B36" />
  <Text style={styles.addButtonText}>Add Combo Service</Text>
</TouchableOpacity>

{/* Modal to Select Combo Services to Add *\/}
<Modal
  visible={showAddServiceModal}
  transparent
  animationType="slide"
>
  <SafeAreaView style={styles.modalContainer}>
    <View style={styles.modalHeader}>
      <TouchableOpacity onPress={() => setShowAddServiceModal(false)}>
        <Icon name="close" size={24} />
      </TouchableOpacity>
      <Text style={styles.modalTitle}>Add Combo Service</Text>
    </View>
    
    <ScrollView style={styles.modalContent}>
      {availableComboServices.map((combo) => (
        <TouchableOpacity
          key={combo._id}
          style={styles.comboOption}
          onPress={() => {
            // Add this combo service
            const newService: Service = {
              _id: combo._id,
              serviceId: combo._id,
              serviceName: combo.comboName,
              amount: combo.discountedPrice,
              serviceType: combo.serviceType,
              gender: combo.genderSupport,
              isCombo: true,
            };
            setServices([...services, newService]);
            setShowAddServiceModal(false);
          }}
        >
          <Text style={styles.comboName}>{combo.comboName}</Text>
          <Text style={styles.comboPrice}>₹{combo.discountedPrice}</Text>
          <Text style={styles.comboDuration}>{combo.duration}</Text>
          <Text style={styles.comboDescription}>{combo.description}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </SafeAreaView>
</Modal>
*/


/**
 * ==========================================
 * 5. SAVE COMBO SERVICES TO BACKEND
 * ==========================================
 */

/*
When saving selected services, include combo services in the payload:

const payload = {
  userId: userId,
  selectedServices: [
    // Regular services
    {
      serviceId: '1',
      serviceName: 'Haircut',
      amount: 500,
      serviceType: ['Salon'],
      gender: ['Male', 'Female'],
    },
    // Combo services
    {
      serviceId: 'combo_id_from_api', // Use _id from combo response
      serviceName: 'Women Color + Cut Combo',
      amount: 6499, // Use discountedPrice from API
      serviceType: ['Hair', 'Color'],
      gender: ['Female', 'Both'],
      isCombo: true, // Mark as combo
    },
  ]
};

await fetch(`${API_BASE_URL_WITH_API}/profile/${userId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
*/


/**
 * ==========================================
 * 6. EXAMPLE COMBO SERVICES IN DATABASE
 * ==========================================
 */

const EXAMPLE_COMBOS = [
  {
    _id: '507f1f77bcf86cd799439011',
    comboName: 'Women Color + Cut Combo (Premium Feel)',
    description: 'Balayage + Shape Edit with Melted & Magic × Shape Studio',
    originalPrice: 8123,
    discountedPrice: 6499,
    discountPercentage: 20,
    duration: '180 mins',
    genderSupport: ['Female', 'Both'],
    serviceType: ['Hair', 'Color'],
    category: 'Premium',
    includedServices: [
      { serviceId: '15', serviceName: 'Balayage Coloring', duration: '90 mins' },
      { serviceId: '16', serviceName: 'Shape Edit', duration: '60 mins' },
      { serviceId: '17', serviceName: 'Melted & Magic Finish', duration: '30 mins' },
    ],
    isActive: true,
  },
  {
    _id: '507f1f77bcf86cd799439012',
    comboName: 'Global Color + Luxe Cut',
    description: 'Premium color and cutting experience with The Color Affair × Shape Studio',
    originalPrice: 5373,
    discountedPrice: 4299,
    discountPercentage: 20,
    duration: '150 mins',
    genderSupport: ['Female', 'Both'],
    serviceType: ['Hair', 'Color'],
    category: 'Premium',
    includedServices: [
      { serviceId: '18', serviceName: 'Global Color Treatment', duration: '75 mins' },
      { serviceId: '19', serviceName: 'Luxe Cut', duration: '60 mins' },
      { serviceId: '20', serviceName: 'Color Affair Styling', duration: '15 mins' },
    ],
    isActive: true,
  },
  // ... See backend seed script for more examples
];


/**
 * ==========================================
 * 7. TYPESCRIPT INTERFACE TO ADD
 * ==========================================
 */

/*
interface IComboService {
  _id: string;
  comboName: string;
  description?: string;
  image?: string;
  originalPrice: number;
  discountedPrice: number;
  discountPercentage?: number;
  duration?: string;
  genderSupport: string[];
  serviceType: string[];
  includedServices: {
    serviceId: string;
    serviceName: string;
    duration?: string;
  }[];
  category?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface Service {
  _id?: string;
  serviceId: string;
  serviceName: string;
  amount: number;
  serviceType: string | string[];
  gender: string | string[];
  isCombo?: boolean; // Add this field
  images?: { [key: string]: string };
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
*/


/**
 * ==========================================
 * 8. STYLING SUGGESTIONS
 * ==========================================
 */

/*
// Add these styles for combo service display

comboCard: {
  backgroundColor: '#FFF9F0', // Light orange background for premium feel
  borderLeftWidth: 4,
  borderLeftColor: '#FD8B36',
  borderRadius: 8,
  padding: 16,
  marginBottom: 12,
},

priceContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  marginVertical: 8,
  gap: 8,
},

originalPrice: {
  fontSize: 12,
  color: '#999',
  textDecorationLine: 'line-through',
},

discountedPrice: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#FD8B36',
},

discountBadge: {
  backgroundColor: '#FD8B36',
  color: '#fff',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 'bold',
},

duration: {
  fontSize: 12,
  color: '#666',
  marginVertical: 4,
},

sectionDivider: {
  marginVertical: 20,
  paddingHorizontal: 16,
  borderTopWidth: 1,
  borderTopColor: '#E0E0E0',
  paddingTop: 16,
},

sectionTitle: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#333',
  marginBottom: 12,
},
*/


/**
 * ==========================================
 * 9. TESTING CHECKLIST
 * ==========================================
 */

/*
[ ] API endpoint is accessible: http://YOUR_IP:3000/api/combo-services
[ ] ComboServices are fetched successfully on page load
[ ] Combo services display correctly with all details
[ ] User can toggle/select combo services
[ ] Modal shows when selecting a combo service
[ ] Selected combo services persist in state
[ ] Combo services can be deselected
[ ] Edit functionality works for combo services
[ ] Prices are correctly displayed (original & discounted)
[ ] Discount percentage is calculated correctly
[ ] Gender support and service type tags display correctly
[ ] Duration displays correctly
[ ] Combo services are saved to backend with 'isCombo: true' flag
[ ] Can add multiple combo services
[ ] Can mix regular and combo services in same selection
*/
