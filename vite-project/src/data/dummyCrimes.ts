export interface CrimeData {
  id: number;
  lat: number;
  lng: number;
  crime_type: string;
  time_of_day: "Day" | "Night";
  severity_score: number;
  location_name: string;
  date: string;
}

export const dummyCrimes: CrimeData[] = [
  // High crime area - Old Dhaka (Night crimes)
  { id: 1, lat: 23.7104, lng: 90.4074, crime_type: "Mugging", time_of_day: "Night", severity_score: 9, location_name: "Sadarghat", date: "2025-11-10" },
  { id: 2, lat: 23.7165, lng: 90.4080, crime_type: "Robbery", time_of_day: "Night", severity_score: 8, location_name: "Bangshal", date: "2025-11-09" },
  { id: 3, lat: 23.7185, lng: 90.4095, crime_type: "Theft", time_of_day: "Night", severity_score: 7, location_name: "Chawkbazar", date: "2025-11-11" },
  
  // Gulshan area (Mixed)
  { id: 4, lat: 23.7808, lng: 90.4142, crime_type: "Theft", time_of_day: "Day", severity_score: 5, location_name: "Gulshan 1", date: "2025-11-08" },
  { id: 5, lat: 23.7925, lng: 90.4077, crime_type: "Pickpocketing", time_of_day: "Day", severity_score: 4, location_name: "Gulshan 2", date: "2025-11-07" },
  { id: 6, lat: 23.7865, lng: 90.4123, crime_type: "Mugging", time_of_day: "Night", severity_score: 6, location_name: "Gulshan Avenue", date: "2025-11-10" },
  
  // Dhanmondi area
  { id: 7, lat: 23.7461, lng: 90.3742, crime_type: "Snatching", time_of_day: "Day", severity_score: 6, location_name: "Dhanmondi 27", date: "2025-11-09" },
  { id: 8, lat: 23.7510, lng: 90.3780, crime_type: "Theft", time_of_day: "Night", severity_score: 5, location_name: "Dhanmondi 15", date: "2025-11-08" },
  { id: 9, lat: 23.7430, lng: 90.3810, crime_type: "Mugging", time_of_day: "Night", severity_score: 7, location_name: "Dhanmondi 32", date: "2025-11-11" },
  
  // Motijheel (Commercial area - high day crime)
  { id: 10, lat: 23.7330, lng: 90.4170, crime_type: "Pickpocketing", time_of_day: "Day", severity_score: 8, location_name: "Motijheel", date: "2025-11-10" },
  { id: 11, lat: 23.7345, lng: 90.4185, crime_type: "Snatching", time_of_day: "Day", severity_score: 7, location_name: "Dilkusha", date: "2025-11-09" },
  { id: 12, lat: 23.7310, lng: 90.4155, crime_type: "Theft", time_of_day: "Night", severity_score: 6, location_name: "Motijheel Circle", date: "2025-11-08" },
  
  // Mirpur area
  { id: 13, lat: 23.8223, lng: 90.3654, crime_type: "Robbery", time_of_day: "Night", severity_score: 9, location_name: "Mirpur 10", date: "2025-11-11" },
  { id: 14, lat: 23.8103, lng: 90.3688, crime_type: "Mugging", time_of_day: "Night", severity_score: 8, location_name: "Mirpur 11", date: "2025-11-10" },
  { id: 15, lat: 23.8050, lng: 90.3710, crime_type: "Theft", time_of_day: "Day", severity_score: 5, location_name: "Mirpur 12", date: "2025-11-09" },
  
  // Uttara area
  { id: 16, lat: 23.8759, lng: 90.3795, crime_type: "Snatching", time_of_day: "Day", severity_score: 4, location_name: "Uttara Sector 3", date: "2025-11-08" },
  { id: 17, lat: 23.8689, lng: 90.3835, crime_type: "Theft", time_of_day: "Night", severity_score: 5, location_name: "Uttara Sector 7", date: "2025-11-10" },
  { id: 18, lat: 23.8820, lng: 90.3952, crime_type: "Mugging", time_of_day: "Night", severity_score: 6, location_name: "Uttara Sector 10", date: "2025-11-11" },
  
  // Bashundhara area
  { id: 19, lat: 23.8103, lng: 90.4255, crime_type: "Theft", time_of_day: "Day", severity_score: 3, location_name: "Bashundhara R/A", date: "2025-11-07" },
  { id: 20, lat: 23.8145, lng: 90.4290, crime_type: "Snatching", time_of_day: "Night", severity_score: 4, location_name: "Bashundhara Block C", date: "2025-11-09" },
  
  // Banani area
  { id: 21, lat: 23.7937, lng: 90.4040, crime_type: "Pickpocketing", time_of_day: "Day", severity_score: 5, location_name: "Banani", date: "2025-11-10" },
  { id: 22, lat: 23.7965, lng: 90.4065, crime_type: "Theft", time_of_day: "Night", severity_score: 6, location_name: "Banani Road 11", date: "2025-11-08" },
  
  // Mohammadpur area
  { id: 23, lat: 23.7654, lng: 90.3580, crime_type: "Mugging", time_of_day: "Night", severity_score: 7, location_name: "Mohammadpur", date: "2025-11-11" },
  { id: 24, lat: 23.7595, lng: 90.3620, crime_type: "Snatching", time_of_day: "Day", severity_score: 6, location_name: "Town Hall", date: "2025-11-09" },
  
  // Farmgate area
  { id: 25, lat: 23.7575, lng: 90.3890, crime_type: "Pickpocketing", time_of_day: "Day", severity_score: 7, location_name: "Farmgate", date: "2025-11-10" },
  { id: 26, lat: 23.7590, lng: 90.3915, crime_type: "Snatching", time_of_day: "Day", severity_score: 6, location_name: "Karwan Bazar", date: "2025-11-08" },
  
  // Shahbagh area
  { id: 27, lat: 23.7385, lng: 90.3955, crime_type: "Theft", time_of_day: "Night", severity_score: 5, location_name: "Shahbagh", date: "2025-11-09" },
  { id: 28, lat: 23.7355, lng: 90.3980, crime_type: "Mugging", time_of_day: "Night", severity_score: 6, location_name: "TSC Area", date: "2025-11-11" },
  
  // Jatrabari area
  { id: 29, lat: 23.7105, lng: 90.4315, crime_type: "Robbery", time_of_day: "Night", severity_score: 8, location_name: "Jatrabari", date: "2025-11-10" },
  { id: 30, lat: 23.7145, lng: 90.4290, crime_type: "Snatching", time_of_day: "Day", severity_score: 7, location_name: "Sayedabad", date: "2025-11-09" },
];
