import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Users,
  Stethoscope,
  UserCheck,
  Search,
  Crown,
  Star,
  FileText,
} from "lucide-react";
import SearchBar from "../components/SearchBar/SearchBar";
import EmployeeCard from "../components/EmployeeCard";
import EmployeeModal from "../components/EmployeeModal";
import AddEmployeeModal from "../components/AddEmployeeModal";
import DoctorProfileDetails from "./DoctorProfileDetails";
import {
  getManagers,
  getDoctors,
  getAssistants,
  getHeadDoctors,
  getHeadAssistants,
  getSpecialistsDoctor,
  getContentManagers,
} from "../utils/api";
import "../styles/EmployeeManagement.css";
import LoadingComponent from "../components/Loading/LoadingComponent";
import AssistantDetailsModal from "./AssistantDetailsModal";
import { useBranch } from "../context/BranchContext";
import { socket } from "../utils/socket";

function EmployeeManagement() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get active tab from URL parameter or default to "all"
  const urlTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(urlTab || "all");

  // Employees
  const [managers, setManagers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [headDoctors, setHeadDoctors] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [headAssistants, setHeadAssistants] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [contentManagers, setContentManagers] = useState([]);
  const [selectedAssistant, setSelectedAssistant] = useState(null);
  const [showAssistantModal, setShowAssistantModal] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [defaultEmployeeType, setDefaultEmployeeType] = useState(null);
  const [isAddDoctorModalOpen, setIsAddDoctorModalOpen] = useState(false);
  const [isDoctorViewOpen, setIsDoctorViewOpen] = useState(false);
  const [selectedDoctorForView, setSelectedDoctorForView] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const { selectedBranch } = useBranch();

  // Update URL when active tab changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (activeTab === "all") {
      params.delete("tab");
    } else {
      params.set("tab", activeTab);
    }
    setSearchParams(params);
  }, [activeTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (selectedBranch) {
      loadEmployees(selectedBranch);
    }
  }, [selectedBranch]);

  // Realtime updates: reload lists when other clients create/update/delete
  useEffect(() => {
    const handleEmployeeChanged = () => {
      if (selectedBranch) loadEmployees(selectedBranch);
    };

    socket.on("doctorCreated", handleEmployeeChanged);
    socket.on("doctorUpdated", handleEmployeeChanged);
    socket.on("doctorDeleted", handleEmployeeChanged);
    socket.on("manager-created", handleEmployeeChanged);
    socket.on("manager-updated", handleEmployeeChanged);
    socket.on("manager-deleted", handleEmployeeChanged);
    socket.on("assistantUpdated", handleEmployeeChanged);
    socket.on("headDoctorUpdated", handleEmployeeChanged);
    socket.on("headAssistantUpdated", handleEmployeeChanged);
    socket.on("specialistUpdated", handleEmployeeChanged);
    socket.on("content_manager_created", handleEmployeeChanged);
    socket.on("contentManagerUpdated", handleEmployeeChanged);

    return () => {
      socket.off("doctorCreated", handleEmployeeChanged);
      socket.off("doctorUpdated", handleEmployeeChanged);
      socket.off("doctorDeleted", handleEmployeeChanged);
      socket.off("manager-created", handleEmployeeChanged);
      socket.off("manager-updated", handleEmployeeChanged);
      socket.off("manager-deleted", handleEmployeeChanged);
      socket.off("assistantUpdated", handleEmployeeChanged);
      socket.off("headDoctorUpdated", handleEmployeeChanged);
      socket.off("headAssistantUpdated", handleEmployeeChanged);
      socket.off("specialistUpdated", handleEmployeeChanged);
      socket.off("content_manager_created", handleEmployeeChanged);
      socket.off("contentManagerUpdated", handleEmployeeChanged);
    };
  }, [selectedBranch]);

  const loadEmployees = async (branchId) => {
    setLoading(true);
    setError(null);

    try {
      const [
        managersData,
        doctorsData,
        headDoctorsData,
        assistantsData,
        headAssistantsData,
        specialistsData,
        contentManagersData,
      ] = await Promise.all([
        getManagers(branchId).catch(() => []),
        getDoctors(branchId).catch(() => []),
        getHeadDoctors(branchId).catch(() => []),
        getAssistants(branchId).catch(() => []),
        getHeadAssistants(branchId).catch(() => []),
        getSpecialistsDoctor(branchId).catch(() => []),
        getContentManagers(branchId).catch(() => []),
      ]);

      setManagers(managersData?.managers || []);
      setDoctors(doctorsData?.data || doctorsData?.doctors || []);
      setHeadDoctors(headDoctorsData?.headDoctors || []);
      setAssistants(assistantsData?.assistants || []);
      setHeadAssistants(headAssistantsData?.headAssistants || []);
      setSpecialists(specialistsData?.specialists || []);
      setContentManagers(
        contentManagersData?.contentManagers || contentManagersData || []
      );
    } catch (err) {
      setError(t("employees.error_load"));
    } finally {
      setLoading(false);
    }
  };

  // Open the AssistantDetailsModal when "View Assigned Doctors" is clicked
  const handleViewAssistantDetails = (employee) => {
    setSelectedAssistant(employee);
    setShowAssistantModal(true);
  };

  // Close the AssistantDetailsModal
  const closeAssistantModal = () => {
    setSelectedAssistant(null);
    setShowAssistantModal(false);
  };

  const handleViewDetails = (employee, type) => {
    if (type === "doctor" || type === "head_doctor") {
      setSelectedDoctorForView(employee);
      setIsDoctorViewOpen(true);
    } else {
      setSelectedEmployee(employee);
      setSelectedType(type);
      setIsDetailModalOpen(true);
    }
  };

  const handleUpdate = (updatedEmployee) => {
    const updateList = (list, setter) =>
      setter((prev) =>
        prev.map((emp) =>
          (emp.id || emp._id) === (updatedEmployee.id || updatedEmployee._id)
            ? { ...emp, ...updatedEmployee }
            : emp
        )
      );

    switch (selectedType) {
      case "managers":
        updateList(managers, setManagers);
        break;
      case "doctor":
        updateList(doctors, setDoctors);
        break;
      case "head_doctor":
        updateList(headDoctors, setHeadDoctors);
        break;
      case "assistant":
        updateList(assistants, setAssistants);
        break;
      case "head_assistant":
        updateList(headAssistants, setHeadAssistants);
        break;
      case "specialist":
        updateList(specialists, setSpecialists);
        break;
      case "content_manager":
        updateList(contentManagers, setContentManagers);
        break;
      default:
        break;
    }

    setSelectedEmployee((prev) => ({ ...prev, ...updatedEmployee }));
  };

  const handleDelete = (id, type) => {
    const deleteFromList = (setter) =>
      setter((prev) => prev.filter((emp) => (emp.id || emp._id) !== id));

    switch (type) {
      case "manager":
      case "managers":
        deleteFromList(setManagers);
        break;
      case "doctor":
        deleteFromList(setDoctors);
        break;
      case "head_doctor":
        deleteFromList(setHeadDoctors);
        break;
      case "assistant":
        deleteFromList(setAssistants);
        break;
      case "head_assistant":
        deleteFromList(setHeadAssistants);
        break;
      case "specialist":
        deleteFromList(setSpecialists);
        break;
      case "content_manager":
        deleteFromList(setContentManagers);
        break;
      default:
        break;
    }
  };

  const handleAddEmployee = (newEmployee, type) => {
    const addToList = (setter) => setter((prev) => [...prev, newEmployee]);

    switch (type) {
      case "managers":
        addToList(setManagers);
        break;
      case "doctor":
      case "head_doctor":
        // Both doctor types go to the same doctors list
        addToList(setDoctors);
        break;
      case "assistant":
        addToList(setAssistants);
        break;
      case "head_assistant":
        addToList(setHeadAssistants);
        break;
      case "specialist":
        addToList(setSpecialists);
        break;
      case "content_manager":
        addToList(setContentManagers);
        break;
      default:
        break;
    }

    loadEmployees();
  };

  const filterEmployees = (employees) => {
    if (!searchQuery) return employees;
    return employees.filter((emp) => {
      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      const email = emp.email?.toLowerCase() || "";
      const phone = emp.phoneNumber || "";
      return (
        fullName.includes(searchQuery.toLowerCase()) ||
        email.includes(searchQuery.toLowerCase()) ||
        phone.includes(searchQuery)
      );
    });
  };

  const getFilteredEmployees = () => {
    const data = {
      managers: filterEmployees(managers),
      doctors: filterEmployees([...doctors, ...headDoctors]), // Combine doctors and headDoctors
      assistants: filterEmployees(assistants),
      headAssistants: filterEmployees(headAssistants),
      specialists: filterEmployees(specialists),
      contentManagers: filterEmployees(contentManagers),
    };

    if (activeTab === "all") return data;

    const filtered = {
      managers: [],
      doctors: [],
      headDoctors: [],
      assistants: [],
      headAssistants: [],
      specialists: [],
      contentManagers: [],
    };
    filtered[activeTab] = data[activeTab];
    return filtered;
  };

  const filteredData = getFilteredEmployees();
  const totalCount =
    filteredData.managers.length +
    filteredData.doctors.length +
    filteredData.assistants.length +
    filteredData.headAssistants.length +
    filteredData.specialists.length +
    filteredData.contentManagers.length;

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="employee-management">
      <div className="employee-management-header">
        <div className="employee-header-content">
          <h1>{t("employees.title")}</h1>
          <p>{t("employees.subtitle")}</p>
        </div>
        <button
          className="add-employee-btn"
          onClick={() => {
            if (activeTab === "doctors") {
              setIsAddDoctorModalOpen(true);
            } else {
              setDefaultEmployeeType(null);
              setIsAddModalOpen(true);
            }
          }}
        >
          <Plus size={20} />
          <span>{t("employees.add_employee")}</span>
        </button>
      </div>

      <div className="employee-management-controls">
        <SearchBar
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("employees.search_placeholder")}
        />

        <div className="employee-tabs">
          <button
            className={`employee-tab ${activeTab === "all" ? "active" : ""}`}
            onClick={() => handleTabChange("all")}
          >
            <Users size={18} />
            <span>{t("employees.tabs.all", { count: totalCount })}</span>
          </button>
          <button
            className={`employee-tab ${
              activeTab === "managers" ? "active" : ""
            }`}
            onClick={() => handleTabChange("managers")}
          >
            <Stethoscope size={18} />
            <span>
              {t("employees.tabs.managers", { count: managers.length })}
            </span>
          </button>
          <button
            className={`employee-tab ${
              activeTab === "doctors" ? "active" : ""
            }`}
            onClick={() => handleTabChange("doctors")}
          >
            <Stethoscope size={18} />
            <span>
              {t("employees.tabs.doctors", { count: doctors.length + headDoctors.length })}
            </span>
          </button>
          <button
            className={`employee-tab ${
              activeTab === "assistants" ? "active" : ""
            }`}
            onClick={() => handleTabChange("assistants")}
          >
            <UserCheck size={18} />
            <span>
              {t("employees.tabs.assistants", { count: assistants.length })}
            </span>
          </button>
          <button
            className={`employee-tab ${
              activeTab === "headAssistants" ? "active" : ""
            }`}
            onClick={() => handleTabChange("headAssistants")}
          >
            <Crown size={18} />
            <span>
              {t("employees.tabs.head_assistants", {
                count: headAssistants.length,
              })}
            </span>
          </button>
          <button
            className={`employee-tab ${
              activeTab === "specialists" ? "active" : ""
            }`}
            onClick={() => handleTabChange("specialists")}
          >
            <Star size={18} />
            <span>
              {t("employees.tabs.specialists", { count: specialists.length })}
            </span>
          </button>
          <button
            className={`employee-tab ${
              activeTab === "contentManagers" ? "active" : ""
            }`}
            onClick={() => handleTabChange("contentManagers")}
          >
            <FileText size={18} />
            <span>
              {t("employees.tabs.content_managers", {
                count: contentManagers.length,
              })}
            </span>
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingComponent message={t("employees.loading")} />
      ) : error ? (
        <div className="error-state">
          <p>{error}</p>
          <button onClick={loadEmployees} className="retry-btn">
            {t("employees.retry")}
          </button>
        </div>
      ) : totalCount === 0 ? (
        <div className="empty-state">
          <Users size={64} />
          <h2>{t("employees.no_employees_found")}</h2>
          <p>
            {searchQuery
              ? t("employees.adjust_search_terms")
              : t("employees.get_started_message")}
          </p>
          {!searchQuery && (
            <button
              className="add-employee-btn"
              onClick={() => setIsAddModalOpen(true)}
            >
              <span>{t("employees.add_employee")}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="employees-grid">
          {filteredData.managers.map((manager) => (
            <EmployeeCard
              key={manager.id || manager._id}
              employee={manager}
              type="manager"
              onViewDetails={handleViewDetails}
            />
          ))}
          {filteredData.doctors.map((doctor) => (
            <EmployeeCard
              key={doctor.id || doctor._id}
              employee={doctor}
              type={doctor.role === "head_doctor" ? "head_doctor" : "doctor"}
              onViewDetails={handleViewDetails}
            />
          ))}
          {filteredData.assistants.map((assistant) => (
            <EmployeeCard
              key={assistant.id || assistant._id}
              employee={assistant}
              type="assistant"
              onViewDetails={handleViewDetails}
              onViewAssistantDetails={handleViewAssistantDetails}
            />
          ))}
          {filteredData.headAssistants.map((assistant) => (
            <EmployeeCard
              key={assistant.id || assistant._id}
              employee={assistant}
              type="head_assistant"
              onViewDetails={handleViewDetails}
            />
          ))}
          {filteredData.specialists.map((specialist) => (
            <EmployeeCard
              key={specialist.id || specialist._id}
              employee={specialist}
              type="specialist"
              onViewDetails={handleViewDetails}
            />
          ))}
          {filteredData.contentManagers.map((contentManager) => (
            <EmployeeCard
              key={contentManager.id || contentManager._id}
              employee={contentManager}
              type="content_manager"
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}

      <EmployeeModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        employee={selectedEmployee}
        type={selectedType}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setDefaultEmployeeType(null);
        }}
        onAdd={handleAddEmployee}
        defaultEmployeeType={defaultEmployeeType}
        onDoctorSelect={() => {
          setIsAddModalOpen(false);
          setIsAddDoctorModalOpen(true);
        }}
      />

      {isAddDoctorModalOpen && (
        <DoctorProfileDetails
          doctor={null}
          isEdit={false}
          onClose={() => setIsAddDoctorModalOpen(false)}
          onSave={() => {
            setIsAddDoctorModalOpen(false);
            if (selectedBranch) loadEmployees(selectedBranch);
          }}
        />
      )}

      {isDoctorViewOpen && (
        <DoctorProfileDetails
          doctor={selectedDoctorForView}
          isEdit={true}
          onClose={() => {
            setIsDoctorViewOpen(false);
            setSelectedDoctorForView(null);
          }}
          onSave={() => {
            setIsDoctorViewOpen(false);
            setSelectedDoctorForView(null);
            if (selectedBranch) loadEmployees(selectedBranch);
          }}
        />
      )}
      {showAssistantModal && (
        <AssistantDetailsModal
          assistant={selectedAssistant}
          isOpen={showAssistantModal}
          onClose={closeAssistantModal}
        />
      )}
    </div>
  );
}

export default EmployeeManagement;
