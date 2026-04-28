const AssigneePopover = ({ task, projectId, onClose, onUpdate }) => {
  const [members, setMembers] = useState([]);
  const [selected, setSelected] = useState(task.assignedTo || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await getProjectMembers(projectId);
      setMembers(res.data.data || []);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (email) => {
    setSelected((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const handleSave = async () => {
    try {
      await updateTask(task._id, { assignedTo: selected });
      onUpdate(); // refresh board
      onClose();
    } catch (err) {
    }
  };

  return (
    <div className="popover-container assignees-popover">
      <div className="popover-content">
        <h4 style={{ marginBottom: "8px" }}>Assign Members</h4>

        {loading ? (
          <p style={{ fontSize: "13px", color: "#64748b" }}>Loading...</p>
        ) : members.length ? (
          <div className="employee-list">
            {members.map((email, idx) => (
              <label key={idx} className="employee-item">
                <input
                  type="checkbox"
                  checked={selected.includes(email)}
                  onChange={() => toggleMember(email)}
                />
                <span>{email}</span>
              </label>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: "13px", color: "#94a3b8" }}>
            No project members found.
          </p>
        )}

        <div className="popover-actions">
          <button className="confirm-btn" onClick={handleSave}>
            Save
          </button>
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
