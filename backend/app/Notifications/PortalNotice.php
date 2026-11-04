<?php

namespace App\Notifications;

/**
 * A one-off message: schedule changes, follow-ups due, account security. Follows the rule of
 * AppNotification: the text may name a patient but never says anything clinical. A notice
 * without a category cannot be turned off, which is what account security alerts need.
 */
class PortalNotice extends AppNotification
{
    public function __construct(
        public string $noticeKind,
        public string $noticeTitle,
        public string $noticeMessage,
        public ?string $noticeCategory = null,
        public ?array $noticeResource = null,
    ) {
        $this->afterCommit();
    }

    protected function kind(): string
    {
        return $this->noticeKind;
    }

    protected function category(): ?string
    {
        return $this->noticeCategory;
    }

    protected function title(): string
    {
        return $this->noticeTitle;
    }

    protected function message(): string
    {
        return $this->noticeMessage;
    }

    protected function resource(): ?array
    {
        return $this->noticeResource;
    }
}
