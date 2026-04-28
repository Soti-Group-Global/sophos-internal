/**
 * Script to manually add imagePublicUrl to getWebsiteDoctorById and getWebsiteDoctorBySlug
 * 
 * Add this code AFTER subSpecialties mapping in both functions:
 * 
 * // Generate public image URL for SEO
 * const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
 * const imagePublicUrl = doctor.profileFileId 
 *   ? `${baseUrl}/api/website/doctors/profile-image/${doctor.profileFileId}`
 *   : null;
 * 
 * Then add this field to formattedDoctor object:
 *   imagePublicUrl: imagePublicUrl, // Direct URL for SEO meta tags
 * 
 * Also update:
 *   imageUrl: imageData ? imageData.imageUrl : (doctor.imageUrl || doctor.photo || null),
 *   profileFileId: doctor.profileFileId || null,
 *   photo: doctor.photo || null,
 */

