<?php
// Ensure session and auth are initialized before any output so cookies can be set
require_once __DIR__ . '/assets/auth.php';
include __DIR__ . '/templates/header/header-fragment.php';
?>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Calendar Settings</title>
        <script src="settings.js" defer></script>
    </head>

    <div style="padding-left:18px;">

    <h3>Default view</h3>
    <p>Select which view should open by default:</p>
    <div>
        <select id="default-view-select">
            <option value="month">Month</option>
            <option value="week">Week</option>
            <option value="day">Day</option>
        </select>
    </div>

    <hr style="margin:16px 0;">

    <h3>Week settings</h3>
    <p>Choose the first day of the week:</p>
    <div style="display:flex; gap:12px; align-items:center;">
        <label><input type="radio" name="calendar-first-day" value="sunday"> Sunday</label>
        <label><input type="radio" name="calendar-first-day" value="monday"> Monday</label>
    </div>

    <hr style="margin:16px 0;">

    <h3>Layout</h3>
    <div style="display:flex; gap:12px; align-items:center;">
        <label><input type="checkbox" id="menu-centered"> Center navigation menu</label>
    </div>

    <hr style="margin:16px 0;">

    <h3>Default category</h3>
    <p>Set a default category to assign to newly created events.</p>
    <div style="display:flex; gap:8px; align-items:center; margin-top:8px;">
        <!-- Populated by settings.js from CRUD.php?action=categories -->
        <select id="default-category-id" style="width:220px; padding:6px; border-radius:6px;">
            <option value="">(none)</option>
        </select>
        <input type="text" id="new-category-name" placeholder="New category name" style="width:180px;">
        <input type="color" id="new-category-color" value="#3b82f6">
        <button id="add-category-btn" type="button">Add category</button>
        <span id="add-category-msg" style="display:none;color:green;margin-left:8px;">Added</span>
    </div>

    <hr style="margin:16px 0;">

    <h3>Manage categories</h3>
    <p>Edit or delete existing categories. Changes update the default-category select automatically.</p>
    <div id="categories-management" style="margin-top:8px;">
        <table id="categories-table" style="width:100%; border-collapse:collapse;">
            <thead>
                <tr style="text-align:left; border-bottom:1px solid #ddd;">
                    <th style="padding:6px; width:40%">Name</th>
                    <th style="padding:6px; width:20%">Color</th>
                    <th style="padding:6px; width:40%">Actions</th>
                </tr>
            </thead>
            <tbody>
                <!-- Populated by settings.js -->
            </tbody>
        </table>
    </div>

    <hr style="margin:16px 0;">

    <h3>Color palette</h3>
    <p>Choose an overall color palette for the calendar:</p>
    <div style="display:flex; gap:12px; align-items:center;">
        <select id="palette-select">
            <option value="default">Default</option>
            <option value="professional">Professional</option>
        </select>
    </div>

    

    <div style="margin-top:12px; display:flex; gap:8px; align-items:center;">
        <button id="save-theme-btn" type="button">Save</button>
        <button id="clear-theme-btn" type="button">Reset</button>
        <span id="theme-saved" style="display:none;color:green;margin-left:8px;">Saved</span>
    </div>
    
</section>
<br>
<?php include __DIR__ . '/templates/footer/footer.php'; ?>

</div>