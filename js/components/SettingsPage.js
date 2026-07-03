import { ref, computed, onMounted, reactive } from 'vue';
import { supabase } from '../supabase.js';
import { fetchMaterials, fetchProjects, fetchContractors, fetchRequesters, fetchCategories } from '../data.js';
import { toast, toastError } from '../toast.js';
import CategorySelect from './CategorySelect.js';

export default {
  components: { CategorySelect },
  setup() {
    const tab = ref('materials');
    const materials = ref([]);
    const projects = ref([]);
    const contractors = ref([]);
    const requesters = ref([]);
    const catOptions = ref([]);
    const search = ref('');
    const loading = ref(true);

    const load = async () => {
      loading.value = true;
      [materials.value, projects.value, contractors.value, requesters.value, catOptions.value] = await Promise.all([
        fetchMaterials(), fetchProjects(), fetchContractors(), fetchRequesters(), fetchCategories()
      ]);
      loading.value = false;
    };
    onMounted(load);

    const onCategoryCreated = (name) => { if (!catOptions.value.includes(name)) catOptions.value.push(name); };

    // Materials
    const newMat = reactive({ name: '', category: 'อื่นๆ', min: 5 });
    const addMaterial = async () => {
      if (!newMat.name.trim()) return;
      const { data, error } = await supabase.from('materials').insert({
        name: newMat.name.trim(), category: newMat.category.trim() || 'อื่นๆ', min: Number(newMat.min) || 0, stock: 0
      }).select().single();
      if (error) return toastError(error, 'เพิ่มวัสดุไม่สำเร็จ');
      toast('เพิ่มวัสดุแล้ว');
      materials.value = [...materials.value, data].sort((a, b) => a.name.localeCompare(b.name));
      newMat.name = ''; newMat.category = 'อื่นๆ'; newMat.min = 5;
    };
    const updateMaterial = async (m) => {
      const { error } = await supabase.from('materials')
        .update({ category: (m.category || '').trim() || 'อื่นๆ', min: Number(m.min) || 0 }).eq('id', m.id);
      if (error) return toastError(error, 'บันทึกไม่สำเร็จ');
      toast('บันทึกแล้ว');
    };
    const onCategoryChange = (m, val) => { m.category = val; updateMaterial(m); };
    const deleteMaterial = async (m) => {
      if (!confirm('ลบวัสดุนี้?')) return;
      const { error } = await supabase.from('materials').delete().eq('id', m.id);
      if (error) return toastError(error, 'ลบไม่สำเร็จ');
      toast('ลบแล้ว');
      materials.value = materials.value.filter(x => x.id !== m.id);
    };
    const filteredMaterials = computed(() => {
      const q = search.value.trim().toLowerCase();
      if (!q) return materials.value;
      return materials.value.filter(m => m.name.toLowerCase().includes(q));
    });

    // Projects
    const newProjectName = ref('');
    const subInput = reactive({});
    const addProject = async () => {
      if (!newProjectName.value.trim()) return;
      const { data, error } = await supabase.from('projects').insert({ name: newProjectName.value.trim(), sub_projects: [] }).select().single();
      if (error) return toastError(error, 'เพิ่มโครงการไม่สำเร็จ');
      toast('เพิ่มโครงการแล้ว');
      projects.value = [...projects.value, data];
      newProjectName.value = '';
    };
    const deleteProject = async (p) => {
      if (!confirm('ลบโครงการนี้?')) return;
      const { error } = await supabase.from('projects').delete().eq('id', p.id);
      if (error) return toastError(error, 'ลบไม่สำเร็จ');
      toast('ลบแล้ว');
      projects.value = projects.value.filter(x => x.id !== p.id);
    };
    const addSubProject = async (p) => {
      const text = (subInput[p.id] || '').trim();
      if (!text) return;
      const updated = [...(p.sub_projects || []), text];
      const { error } = await supabase.from('projects').update({ sub_projects: updated }).eq('id', p.id);
      if (error) return toastError(error, 'เพิ่มโครงการย่อยไม่สำเร็จ');
      toast('เพิ่มโครงการย่อยแล้ว');
      p.sub_projects = updated;
      subInput[p.id] = '';
    };
    const removeSubProject = async (p, idx) => {
      const updated = (p.sub_projects || []).filter((_, i) => i !== idx);
      const { error } = await supabase.from('projects').update({ sub_projects: updated }).eq('id', p.id);
      if (error) return toastError(error, 'ลบไม่สำเร็จ');
      toast('ลบแล้ว');
      p.sub_projects = updated;
    };

    // Contractors
    const newContractorName = ref('');
    const addContractor = async () => {
      if (!newContractorName.value.trim()) return;
      const { data, error } = await supabase.from('contractors').insert({ name: newContractorName.value.trim() }).select().single();
      if (error) return toastError(error, 'เพิ่มผู้รับเหมาไม่สำเร็จ');
      toast('เพิ่มผู้รับเหมาแล้ว');
      contractors.value = [...contractors.value, data];
      newContractorName.value = '';
    };
    const deleteContractor = async (c) => {
      if (!confirm('ลบผู้รับเหมานี้?')) return;
      const { error } = await supabase.from('contractors').delete().eq('id', c.id);
      if (error) return toastError(error, 'ลบไม่สำเร็จ');
      toast('ลบแล้ว');
      contractors.value = contractors.value.filter(x => x.id !== c.id);
    };

    // Users (requesters) — editable name, since accounts created directly in
    // Supabase have no name metadata and default to their email prefix.
    const updateRequesterName = async (r) => {
      const name = (r.name || '').trim();
      if (!name) return toast('กรุณากรอกชื่อ', 'error');
      const { error } = await supabase.from('requesters').update({ name }).eq('id', r.id);
      if (error) return toastError(error, 'บันทึกไม่สำเร็จ');
      toast('บันทึกแล้ว');
    };

    return { tab, materials, projects, contractors, requesters, search, loading, catOptions, filteredMaterials,
      newMat, addMaterial, updateMaterial, deleteMaterial, onCategoryChange, onCategoryCreated,
      newProjectName, subInput, addProject, deleteProject, addSubProject, removeSubProject,
      newContractorName, addContractor, deleteContractor, updateRequesterName };
  },
  template: `
  <div class="flex flex-col gap-5 animate-fade">
    <h1 class="page-title">ตั้งค่า</h1>

    <div class="segmented" style="max-width:520px;">
      <button class="segmented-btn" :class="{active: tab==='materials'}" @click="tab='materials'">วัสดุ</button>
      <button class="segmented-btn" :class="{active: tab==='projects'}" @click="tab='projects'">โครงการ</button>
      <button class="segmented-btn" :class="{active: tab==='contractors'}" @click="tab='contractors'">ผู้รับเหมา</button>
      <button class="segmented-btn" :class="{active: tab==='users'}" @click="tab='users'">ผู้ใช้งาน</button>
    </div>

    <div v-if="loading" class="text-center text-secondary p-6">กำลังโหลด...</div>

    <!-- Materials tab -->
    <template v-else-if="tab==='materials'">
      <div class="glass-card">
        <h3 class="card-title mb-3">เพิ่มวัสดุใหม่</h3>
        <div class="grid gap-3" style="grid-template-columns: 2fr 1fr 1fr auto;">
          <input v-model="newMat.name" class="input-field" placeholder="ชื่อวัสดุ" @keyup.enter="addMaterial" />
          <CategorySelect v-model="newMat.category" :options="catOptions" @created="onCategoryCreated" />
          <input v-model="newMat.min" type="number" class="input-field" placeholder="ขั้นต่ำ" />
          <button class="btn btn-primary" @click="addMaterial"><span class="icon icon-sm">add</span></button>
        </div>
      </div>

      <div class="search-field w-full"><span class="icon icon-sm text-tertiary">search</span><input v-model="search" placeholder="ค้นหาวัสดุ..." /></div>

      <div class="glass-card">
        <div class="table-wrapper">
          <table>
            <thead><tr><th>วัสดุ</th><th>หมวดหมู่</th><th>คงเหลือ</th><th>ขั้นต่ำ</th><th></th></tr></thead>
            <tbody>
              <tr v-for="m in filteredMaterials" :key="m.id">
                <td>{{ m.name }}</td>
                <td style="min-width:160px;">
                  <CategorySelect :model-value="m.category" :options="catOptions" @update:model-value="val => onCategoryChange(m, val)" @created="onCategoryCreated" />
                </td>
                <td>{{ m.stock }}</td>
                <td><input v-model="m.min" type="number" class="input-field" style="max-width:90px;height:38px;padding:4px 10px;" @change="updateMaterial(m)" /></td>
                <td><button class="btn-icon text-danger" @click="deleteMaterial(m)"><span class="icon icon-sm">delete</span></button></td>
              </tr>
              <tr v-if="filteredMaterials.length===0"><td colspan="5" class="text-center text-secondary">ไม่พบวัสดุ</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Projects tab -->
    <template v-else-if="tab==='projects'">
      <div class="glass-card">
        <h3 class="card-title mb-3">เพิ่มโครงการใหม่</h3>
        <div class="flex gap-2">
          <input v-model="newProjectName" class="input-field" placeholder="ชื่อโครงการ" @keyup.enter="addProject" />
          <button class="btn btn-primary" @click="addProject"><span class="icon icon-sm">add</span></button>
        </div>
      </div>

      <div v-for="p in projects" :key="p.id" class="glass-card">
        <div class="flex items-center justify-between mb-3">
          <h3 class="card-title">{{ p.name }}</h3>
          <button class="btn-icon text-danger" @click="deleteProject(p)"><span class="icon icon-sm">delete</span></button>
        </div>
        <div class="flex gap-2 flex-wrap mb-3">
          <span v-for="(s,idx) in (p.sub_projects||[])" :key="idx" class="pill pill-neutral">
            {{ s }}
            <span class="icon" style="font-size:14px;cursor:pointer;margin-left:4px;" @click="removeSubProject(p, idx)">close</span>
          </span>
          <span v-if="(p.sub_projects||[]).length===0" class="text-sm text-secondary">ยังไม่มีโครงการย่อย</span>
        </div>
        <div class="flex gap-2">
          <input v-model="subInput[p.id]" class="input-field" placeholder="เพิ่มโครงการย่อย..." @keyup.enter="addSubProject(p)" />
          <button class="btn btn-surface" @click="addSubProject(p)">เพิ่ม</button>
        </div>
      </div>
      <div v-if="projects.length===0" class="text-center text-secondary text-sm p-4">ยังไม่มีโครงการ</div>
    </template>

    <!-- Contractors tab -->
    <template v-else-if="tab==='contractors'">
      <div class="glass-card">
        <h3 class="card-title mb-3">เพิ่มผู้รับเหมาใหม่</h3>
        <div class="flex gap-2">
          <input v-model="newContractorName" class="input-field" placeholder="ชื่อผู้รับเหมา" @keyup.enter="addContractor" />
          <button class="btn btn-primary" @click="addContractor"><span class="icon icon-sm">add</span></button>
        </div>
      </div>
      <div class="glass-card">
        <div v-for="c in contractors" :key="c.id" class="flex items-center justify-between" style="padding:10px 0;border-bottom:1px solid var(--divider);">
          <span class="text-primary font-medium">{{ c.name }}</span>
          <button class="btn-icon text-danger" @click="deleteContractor(c)"><span class="icon icon-sm">delete</span></button>
        </div>
        <div v-if="contractors.length===0" class="text-center text-secondary text-sm p-4">ยังไม่มีผู้รับเหมา</div>
      </div>
    </template>

    <!-- Users tab -->
    <template v-else-if="tab==='users'">
      <div class="glass-card">
        <p class="text-sm text-secondary mb-4">แก้ไขชื่อผู้ใช้งาน — สำหรับบัญชีที่สร้างจาก Supabase Dashboard โดยตรงจะยังไม่มีชื่อ ให้กรอกที่นี่</p>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>อีเมล</th><th>ชื่อ</th><th></th></tr></thead>
            <tbody>
              <tr v-for="r in requesters" :key="r.id">
                <td>{{ r.email || '—' }}</td>
                <td><input v-model="r.name" class="input-field" style="height:38px;padding:4px 10px;" @change="updateRequesterName(r)" /></td>
                <td><button class="btn-icon" @click="updateRequesterName(r)"><span class="icon icon-sm">check</span></button></td>
              </tr>
              <tr v-if="requesters.length===0"><td colspan="3" class="text-center text-secondary">ยังไม่มีผู้ใช้งาน</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
  `
};
